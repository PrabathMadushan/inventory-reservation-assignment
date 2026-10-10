use std::collections::HashMap;
use std::env;
use std::fs::File;
use std::io::{Cursor, Read};
use std::time::{SystemTime, UNIX_EPOCH};

use tiny_http::{Header, Method, Response, Server, StatusCode};

const WEBHOOK_URL: &str = "http://127.0.0.1:4000/api/webhooks/payments";
const API_BASE: &str = "http://127.0.0.1:4000/api";
const MAX_BODY: usize = 8 * 1024;
const TICKET_SECONDS: u64 = 5 * 60;

struct Ticket {
    order_id: String,
    return_origin: String,
    expires_unix: u64,
}

struct Gateway {
    secret: String,
    webhook_url: String,
    api_base: String,
    tickets: HashMap<String, Ticket>,
}

fn main() {
    let mut gateway = Gateway {
        secret: required_env("WEBHOOK_SECRET"),
        webhook_url: env::var("WEBHOOK_URL").unwrap_or_else(|_| WEBHOOK_URL.to_string()),
        api_base: env::var("API_BASE").unwrap_or_else(|_| API_BASE.to_string()),
        tickets: HashMap::new(),
    };
    let server = Server::http("127.0.0.1:4001").expect("listen on 127.0.0.1:4001");
    for mut request in server.incoming_requests() {
        let response = dispatch(&mut request, &mut gateway);
        let _ = request.respond(response);
    }
}

fn required_env(name: &str) -> String {
    match env::var(name) {
        Ok(value) if !value.trim().is_empty() => value,
        _ => {
            eprintln!("{name} is required.");
            std::process::exit(1);
        }
    }
}

fn dispatch(request: &mut tiny_http::Request, gateway: &mut Gateway) -> Response<Cursor<Vec<u8>>> {
    let url = request.url().to_string();
    let path = url.split('?').next().unwrap_or("/");
    let origin = header(request, "Origin");
    match (request.method(), path) {
        (Method::Options, "/start" | "/gateway/start") => preflight(&origin),
        (Method::Post, "/start" | "/gateway/start") => start(request, gateway, &origin),
        (Method::Get, "/checkout" | "/gateway/checkout") => checkout_page(&url, gateway),
        (Method::Post, "/checkout" | "/gateway/checkout") => checkout_post(request, gateway),
        _ => page(StatusCode(404), "Not found", "This page is not available."),
    }
}

fn start(
    request: &mut tiny_http::Request,
    gateway: &mut Gateway,
    origin: &str,
) -> Response<Cursor<Vec<u8>>> {
    if !origin_allowed(origin) {
        return json(StatusCode(403), "", r#"{"message":"This origin cannot start payment."}"#);
    }
    let authorization = header(request, "Authorization");
    let token = match bearer(&authorization) {
        Some(token) => token,
        None => {
            return json(
                StatusCode(401),
                origin,
                r#"{"message":"Sign in again before paying."}"#,
            );
        }
    };
    let body = read_body(request);
    let order_id = json_string(&body, "orderId").unwrap_or_default();
    let return_origin = json_string(&body, "returnOrigin").unwrap_or_default();
    if !valid_order_id(&order_id) || return_origin != origin {
        return json(
            StatusCode(400),
            origin,
            r#"{"message":"The payment request is not valid."}"#,
        );
    }
    match pending_order(&gateway.api_base, &token, &order_id) {
        OrderCheck::Pending => {}
        OrderCheck::Unauthorized => {
            return json(StatusCode(401), origin, r#"{"message":"Sign in again before paying."}"#);
        }
        OrderCheck::NotFound => {
            return json(StatusCode(404), origin, r#"{"message":"That order cannot be paid."}"#);
        }
        OrderCheck::NotPending => {
            return json(
                StatusCode(409),
                origin,
                r#"{"message":"Only a pending order can be paid."}"#,
            );
        }
        OrderCheck::Unavailable => {
            return json(
                StatusCode(502),
                origin,
                r#"{"message":"The order service could not be reached."}"#,
            );
        }
    }
    let now = unix_now();
    gateway.tickets.retain(|_, ticket| ticket.expires_unix > now);
    let ticket_id = match random_ticket() {
        Some(value) => value,
        None => {
            return json(
                StatusCode(500),
                origin,
                r#"{"message":"Payment could not be started."}"#,
            );
        }
    };
    gateway.tickets.insert(
        ticket_id.clone(),
        Ticket {
            order_id,
            return_origin,
            expires_unix: now.saturating_add(TICKET_SECONDS),
        },
    );
    json(
        StatusCode(200),
        origin,
        &format!(r#"{{"ticket":"{ticket_id}"}}"#),
    )
}

fn checkout_page(url: &str, gateway: &Gateway) -> Response<Cursor<Vec<u8>>> {
    let Some(ticket_id) = query_param(url, "ticket") else {
        return page(StatusCode(400), "Checkout expired", "Start payment from the order again.");
    };
    match lookup_ticket(gateway, &ticket_id, unix_now()) {
        Some(ticket) => html_page(
            StatusCode(200),
            "Simulated payment",
            &checkout_form(&ticket_id, &ticket.order_id),
        ),
        None => page(
            StatusCode(400),
            "Checkout expired",
            "Start payment from the order again. The payment webhook was not called.",
        ),
    }
}

fn checkout_post(
    request: &mut tiny_http::Request,
    gateway: &mut Gateway,
) -> Response<Cursor<Vec<u8>>> {
    let fields = parse_form(&read_body(request));
    let ticket_id = field(&fields, "ticket").to_string();
    let payment_type = match field(&fields, "action") {
        "succeed" => "PAYMENT_SUCCEEDED",
        "fail" => "PAYMENT_FAILED",
        _ => {
            return page(
                StatusCode(400),
                "Choose Pay or Fail",
                "Use one of the two buttons. The payment webhook was not called.",
            );
        }
    };
    let Some(ticket) = take_ticket(gateway, &ticket_id, unix_now()) else {
        return page(
            StatusCode(400),
            "Checkout expired",
            "Start payment from the order again. The payment webhook was not called.",
        );
    };
    let event_id = event_id();
    let payload = format!(
        r#"{{"eventId":"{}","orderId":"{}","type":"{}"}}"#,
        json_escape(&event_id),
        json_escape(&ticket.order_id),
        payment_type
    );
    let payment = match post_webhook(&gateway.webhook_url, &gateway.secret, &payload) {
        Ok((status, text)) if (200..300).contains(&status) && applied(&text, "CONFIRMED") => {
            "success"
        }
        Ok((status, text)) if (200..300).contains(&status) && applied(&text, "FAILED") => "failure",
        _ => "failure",
    };
    match return_url(&ticket.return_origin, payment, &ticket.order_id) {
        Some(location) => redirect(&location),
        None => page(StatusCode(400), "Return blocked", "The return address is not allowed."),
    }
}

fn lookup_ticket<'a>(gateway: &'a Gateway, ticket_id: &str, now: u64) -> Option<&'a Ticket> {
    let ticket = gateway.tickets.get(ticket_id)?;
    (ticket.expires_unix > now).then_some(ticket)
}

fn take_ticket(gateway: &mut Gateway, ticket_id: &str, now: u64) -> Option<Ticket> {
    let ticket = gateway.tickets.remove(ticket_id)?;
    (ticket.expires_unix > now).then_some(ticket)
}

enum OrderCheck {
    Pending,
    Unauthorized,
    NotFound,
    NotPending,
    Unavailable,
}

fn pending_order(api_base: &str, token: &str, order_id: &str) -> OrderCheck {
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(10))
        .build();
    let url = format!(
        "{}/orders/{}",
        api_base.trim_end_matches('/'),
        order_id
    );
    match agent
        .get(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .call()
    {
        Ok(response) => match response.into_string() {
            Ok(body) if json_string(&body, "status").as_deref() == Some("PENDING") => {
                OrderCheck::Pending
            }
            Ok(_) => OrderCheck::NotPending,
            Err(_) => OrderCheck::Unavailable,
        },
        Err(ureq::Error::Status(401, _)) => OrderCheck::Unauthorized,
        Err(ureq::Error::Status(404, _)) => OrderCheck::NotFound,
        Err(ureq::Error::Status(_, response)) => {
            let _ = response.into_string();
            OrderCheck::NotPending
        }
        Err(_) => OrderCheck::Unavailable,
    }
}

fn post_webhook(url: &str, secret: &str, payload: &str) -> Result<(u16, String), String> {
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(10))
        .build();
    match agent
        .post(url)
        .set("Content-Type", "application/json")
        .set("X-Webhook-Secret", secret)
        .send_string(payload)
    {
        Ok(response) => {
            let status = response.status();
            let text = response.into_string().unwrap_or_default();
            Ok((status, text))
        }
        Err(ureq::Error::Status(status, response)) => {
            let text = response.into_string().unwrap_or_default();
            Ok((status, text))
        }
        Err(_) => Err("The payment API could not be reached.".to_string()),
    }
}

fn applied(body: &str, status: &str) -> bool {
    json_string(body, "outcome").as_deref() == Some("APPLIED")
        && json_string(body, "orderStatus").as_deref() == Some(status)
}

fn preflight(origin: &str) -> Response<Cursor<Vec<u8>>> {
    if origin_allowed(origin) {
        json(StatusCode(204), origin, "")
    } else {
        json(StatusCode(403), "", "")
    }
}

fn checkout_form(ticket: &str, order_id: &str) -> String {
    format!(
        r#"<p>Order <span class="mono">{order}</span></p>
<form method="post" action="">
  <input type="hidden" name="ticket" value="{ticket}">
  <div class="actions">
    <button name="action" value="succeed">Pay</button>
    <button name="action" value="fail" class="fail">Fail</button>
  </div>
</form>
<p class="note">Pay confirms this pending order. Fail releases its stock. You return to the app afterward.</p>"#,
        order = escape(order_id),
        ticket = escape(ticket),
    )
}

fn page(status: StatusCode, title: &str, body: &str) -> Response<Cursor<Vec<u8>>> {
    html_page(status, title, &format!("<p>{}</p>", escape(body)))
}

fn html_page(status: StatusCode, title: &str, body: &str) -> Response<Cursor<Vec<u8>>> {
    let html = format!(
        r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <style>
    body {{ font-family: Georgia, serif; margin: 2rem auto; max-width: 36rem; padding: 0 1rem; color: #1c1917; }}
    form {{ display: grid; gap: 0.75rem; }}
    .actions {{ display: flex; gap: 0.5rem; }}
    button {{ font: inherit; padding: 0.55rem 1rem; }}
    .fail {{ background: #fff; }}
    .mono {{ font-family: ui-monospace, monospace; word-break: break-all; }}
    .note {{ color: #57534e; }}
  </style>
</head>
<body>
  <h1>{title}</h1>
  {body}
</body>
</html>"#,
        title = escape(title),
    );
    with_common_headers(
        add_header(
            Response::from_string(html).with_status_code(status),
            "Content-Type",
            "text/html; charset=utf-8",
        ),
    )
}

fn json(status: StatusCode, origin: &str, body: &str) -> Response<Cursor<Vec<u8>>> {
    let mut response = Response::from_string(body.to_string()).with_status_code(status);
    response = add_header(response, "Content-Type", "application/json; charset=utf-8");
    if origin_allowed(origin) {
        response = add_header(response, "Access-Control-Allow-Origin", origin);
        response = add_header(
            response,
            "Access-Control-Allow-Headers",
            "Authorization, Content-Type",
        );
        response = add_header(response, "Access-Control-Allow-Methods", "POST, OPTIONS");
        response = add_header(response, "Vary", "Origin");
    }
    with_common_headers(response)
}

fn redirect(location: &str) -> Response<Cursor<Vec<u8>>> {
    add_header(
        with_common_headers(Response::from_string(String::new()).with_status_code(StatusCode(303))),
        "Location",
        location,
    )
}

fn with_common_headers(response: Response<Cursor<Vec<u8>>>) -> Response<Cursor<Vec<u8>>> {
    add_header(
        add_header(response, "Cache-Control", "no-store"),
        "Referrer-Policy",
        "no-referrer",
    )
}

fn add_header(
    response: Response<Cursor<Vec<u8>>>,
    name: &str,
    value: &str,
) -> Response<Cursor<Vec<u8>>> {
    let header = Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("header");
    response.with_header(header)
}

fn header(request: &tiny_http::Request, name: &str) -> String {
    request
        .headers()
        .iter()
        .find(|item| {
            item.field
                .as_str()
                .as_str()
                .eq_ignore_ascii_case(name)
        })
        .map(|item| item.value.as_str().trim().to_string())
        .unwrap_or_default()
}

fn read_body(request: &mut tiny_http::Request) -> String {
    let mut buffer = String::new();
    let _ = request
        .as_reader()
        .take(MAX_BODY as u64)
        .read_to_string(&mut buffer);
    buffer
}

fn bearer(value: &str) -> Option<String> {
    let token = value.strip_prefix("Bearer ")?;
    if token.is_empty()
        || token.len() > 4096
        || token
            .chars()
            .any(|character| character.is_whitespace() || character.is_control())
    {
        return None;
    }
    Some(token.to_string())
}

fn origin_allowed(origin: &str) -> bool {
    matches!(
        origin,
        "https://app.prabhathmadhushan.cv" | "http://localhost:5173"
    )
}

fn return_url(origin: &str, payment: &str, order_id: &str) -> Option<String> {
    if !origin_allowed(origin) || !matches!(payment, "success" | "failure") || !valid_order_id(order_id)
    {
        return None;
    }
    Some(format!(
        "{origin}/?payment={payment}&orderId={}",
        encode_query(order_id)
    ))
}

fn valid_order_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 256
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn query_param(url: &str, name: &str) -> Option<String> {
    let query = url.split_once('?')?.1;
    parse_form(query)
        .into_iter()
        .find(|(key, _)| key == name)
        .map(|(_, value)| value)
        .filter(|value| value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit()))
}

fn encode_query(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

fn random_ticket() -> Option<String> {
    let mut bytes = [0u8; 32];
    let mut file = File::open("/dev/urandom").ok()?;
    file.read_exact(&mut bytes).ok()?;
    Some(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn event_id() -> String {
    match random_ticket() {
        Some(value) => format!("gw-{value}"),
        None => format!("gw-{:x}", unix_now()),
    }
}

fn field<'a>(fields: &'a [(String, String)], name: &str) -> &'a str {
    fields
        .iter()
        .find(|(key, _)| key == name)
        .map(|(_, value)| value.as_str())
        .unwrap_or("")
}

fn parse_form(body: &str) -> Vec<(String, String)> {
    body.split('&')
        .filter(|pair| !pair.is_empty())
        .map(|pair| {
            let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
            (decode(key), decode(value))
        })
        .collect()
}

fn decode(value: &str) -> String {
    let value = value.replace('+', " ");
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                std::str::from_utf8(&bytes[index + 1..index + 3]).unwrap_or(""),
                16,
            ) {
                out.push(byte);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn json_string(body: &str, key: &str) -> Option<String> {
    let pattern = format!("\"{key}\"");
    let start = body.find(&pattern)?;
    let rest = body[start + pattern.len()..].trim_start();
    let rest = rest.strip_prefix(':')?.trim_start();
    let rest = rest.strip_prefix('"')?;
    let mut out = String::new();
    let mut characters = rest.chars();
    while let Some(character) = characters.next() {
        match character {
            '"' => return Some(out),
            '\\' => match characters.next()? {
                '"' => out.push('"'),
                '\\' => out.push('\\'),
                'n' => out.push('\n'),
                'r' => out.push('\r'),
                other if !other.is_control() => out.push(other),
                _ => return None,
            },
            other if other.is_control() => return None,
            other => out.push(other),
        }
    }
    None
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn return_addresses_are_exact_allowlisted_origins() {
        assert!(origin_allowed("https://app.prabhathmadhushan.cv"));
        assert!(origin_allowed("http://localhost:5173"));
        assert!(!origin_allowed("https://evil.example"));
        assert!(!origin_allowed("https://app.prabhathmadhushan.cv.evil.example"));
        assert!(!origin_allowed("http://localhost:5173/phish"));
        assert!(!origin_allowed("https://user@app.prabhathmadhushan.cv"));
        assert_eq!(
            return_url(
                "https://app.prabhathmadhushan.cv",
                "success",
                "order-1"
            )
            .as_deref(),
            Some("https://app.prabhathmadhushan.cv/?payment=success&orderId=order-1")
        );
        assert!(return_url("https://evil.example", "success", "order-1").is_none());
        assert!(return_url("https://app.prabhathmadhushan.cv", "other", "order-1").is_none());
    }

    #[test]
    fn a_ticket_can_be_used_once() {
        let mut gateway = Gateway {
            secret: "secret".to_string(),
            webhook_url: WEBHOOK_URL.to_string(),
            api_base: API_BASE.to_string(),
            tickets: HashMap::new(),
        };
        gateway.tickets.insert(
            "ab".repeat(32),
            Ticket {
                order_id: "order-1".to_string(),
                return_origin: "http://localhost:5173".to_string(),
                expires_unix: 100,
            },
        );
        assert!(take_ticket(&mut gateway, &"ab".repeat(32), 50).is_some());
        assert!(take_ticket(&mut gateway, &"ab".repeat(32), 50).is_none());
    }

    #[test]
    fn an_expired_ticket_is_rejected() {
        let mut gateway = Gateway {
            secret: "secret".to_string(),
            webhook_url: WEBHOOK_URL.to_string(),
            api_base: API_BASE.to_string(),
            tickets: HashMap::new(),
        };
        gateway.tickets.insert(
            "cd".repeat(32),
            Ticket {
                order_id: "order-1".to_string(),
                return_origin: "http://localhost:5173".to_string(),
                expires_unix: 10,
            },
        );
        assert!(take_ticket(&mut gateway, &"cd".repeat(32), 10).is_none());
    }

    #[test]
    fn bearer_and_order_ids_are_bounded() {
        assert_eq!(bearer("Bearer abc.def").as_deref(), Some("abc.def"));
        assert!(bearer("Bearer ").is_none());
        assert!(bearer("abc.def").is_none());
        assert!(bearer(&format!("Bearer {}", "a".repeat(4097))).is_none());
        assert!(valid_order_id("order-1"));
        assert!(!valid_order_id(""));
        assert!(!valid_order_id("order/1"));
        assert!(!valid_order_id(&"a".repeat(257)));
    }
}
