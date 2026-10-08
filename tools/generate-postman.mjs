import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Our collection is generated from these explicit scenarios, never a third-party collection.
const directory = resolve("postman");
mkdirSync(directory, { recursive: true });
const destination = resolve(directory, "inventory.postman_collection.json");
const previous = existsSync(destination)
  ? JSON.parse(readFileSync(destination, "utf8"))
  : null;
const examples = new Map(
  previous?.item.flatMap((folder) =>
    folder.item.map((item) => [item.name, item.response]),
  ) ?? [],
);
const helpers = `
const data = pm.response.json();
const get = key => pm.variables.get(key);
const stored = key => JSON.parse(get(key));
function order(o) {
  pm.expect(Object.keys(o).sort()).to.eql(['id','customerId','productId','productName','quantity','unitPriceMinor','totalMinor','currency','status','createdAt','updatedAt','history'].sort());
  ['id','customerId','productId','productName'].forEach(k => pm.expect(o[k]).to.be.a('string').and.not.empty);
  [o.quantity,o.unitPriceMinor,o.totalMinor].forEach(n => pm.expect(Number.isSafeInteger(n)).to.eql(true));
  pm.expect(o.quantity).to.be.above(0);
  pm.expect(o.currency).to.eql('LKR');
  pm.expect(o.totalMinor).to.eql(o.quantity*o.unitPriceMinor);
  pm.expect(['PENDING','CONFIRMED','FAILED','CANCELLED']).to.include(o.status);
  pm.expect(o.history).to.be.an('array').and.have.length(o.status === 'PENDING' ? 1 : 2);
  [o.createdAt,o.updatedAt,...o.history.map(h=>h.occurredAt)].forEach(t=> {
    pm.expect(t).to.match(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/);
    pm.expect(new Date(t).toISOString()).to.eql(t);
  });
  o.history.forEach(h=>pm.expect(Object.keys(h).sort()).to.eql(['fromStatus','toStatus','reason','occurredAt'].sort()));
  pm.expect(o.history[0]).to.include({fromStatus:null,toStatus:'PENDING',reason:'ORDER_CREATED'});
  pm.expect(o.history[o.history.length-1].toStatus).to.eql(o.status);
  if(o.status!=='PENDING') {
    pm.expect(o.history[1]).to.include({fromStatus:'PENDING',reason:{CONFIRMED:'PAYMENT_SUCCEEDED',FAILED:'PAYMENT_FAILED',CANCELLED:'CUSTOMER_CANCELLED'}[o.status]});
    pm.expect(o.history[1].occurredAt).to.eql(o.updatedAt);
  }
}
function page(p,total,number=1,size=10) {
  pm.expect(Object.keys(p).sort()).to.eql(['items','page','pageSize','total'].sort());
  pm.expect(p).to.include({page:number,pageSize:size,total});
  pm.expect(p.items.length).to.eql(Math.max(0,Math.min(size,total-(number-1)*size)));
  p.items.forEach(order);
  for(let i=1;i<p.items.length;i++) { const a=p.items[i-1],b=p.items[i]; pm.expect(a.createdAt>b.createdAt||(a.createdAt===b.createdAt&&a.id>b.id)).to.eql(true); }
}
function productStock(id,quantity) { pm.expect(data.items.find(p=>p.id===get(id)).availableQuantity).to.eql(quantity); }
`;
const folders = [];
let folder;
function section(name) {
  folder = { name, item: [] };
  folders.push(folder);
}
function request(
  name,
  method,
  path,
  status,
  { role, body, headers = [], pre = "", check = "", code } = {},
) {
  const header = [
    ...(body !== undefined
      ? [{ key: "Content-Type", value: "application/json" }]
      : []),
    ...(role
      ? [{ key: "Authorization", value: `Bearer {{${role}Token}}` }]
      : []),
    ...headers,
  ];
  const req = {
    method,
    header,
    url: {
      raw: `{{baseUrl}}${path}`,
      host: ["{{baseUrl}}"],
      path: path.split("?")[0].slice(1).split("/"),
    },
    description:
      "Run the complete collection in folder order from fresh seed data. Runtime tokens/IDs stay in run-local variables.",
  };
  if (path.includes("?"))
    req.url.query = path
      .split("?")[1]
      .split("&")
      .map((pair) => {
        const [key, value] = pair.split("=");
        return { key, value };
      });
  if (body !== undefined)
    req.body = {
      mode: "raw",
      raw: typeof body === "string" ? body : JSON.stringify(body),
      options: { raw: { language: "json" } },
    };
  const tests =
    `${helpers}\npm.test('HTTP ${status}',()=>pm.response.to.have.status(${status}));\n` +
    (code
      ? `pm.test('Exact ${code} error',()=>{pm.expect(Object.keys(data).sort()).to.eql(['code','message']);pm.expect(data.code).to.eql('${code}');pm.expect(data.message).to.be.a('string').and.not.empty;});\n`
      : "") +
    (check ? `pm.test('Scenario invariants',()=>{\n${check}\n});` : "");
  const item = {
    name,
    request: req,
    event: [
      ...(pre
        ? [
            {
              listen: "prerequest",
              script: { type: "text/javascript", exec: pre.trim().split("\n") },
            },
          ]
        : []),
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: tests
            .replace(/\bdata\b/g, "assignmentResponse")
            .trim()
            .split("\n"),
        },
      },
    ],
    response: examples.get(name) ?? [],
  };
  folder.item.push(item);
}
const fresh = (key) =>
  `pm.variables.set('${key}',pm.variables.replaceIn('{{$guid}}'));`;
const keyHeader = (key) => [{ key: "Idempotency-Key", value: `{{${key}}}` }];
const secretHeader = [{ key: "X-Webhook-Secret", value: "{{webhookSecret}}" }];
const createBody = (product, quantity = 1) =>
  `{"productId":"{{${product}}}","quantity":${quantity}}`;
function create(name, role, product, key, id, quantity = 1) {
  request(name, "POST", "/orders", 201, {
    role,
    body: createBody(product, quantity),
    headers: keyHeader(key),
    pre: fresh(key),
    check: `order(data);pm.expect(data.status).to.eql('PENDING');pm.expect(data.customerId).to.eql(get('${role}UserId'));const p=stored('seedProducts').find(p=>p.id===get('${product}'));pm.expect(data).to.include({productId:p.id,productName:p.name,unitPriceMinor:p.unitPriceMinor,quantity:${quantity},totalMinor:p.unitPriceMinor*${quantity}});pm.variables.set('${id}',data.id);pm.variables.set('${id}Snapshot',JSON.stringify(data));`,
  });
}
function payment(
  name,
  id,
  type,
  event,
  outcome,
  status,
  { freshId = false } = {},
) {
  request(name, "POST", "/webhooks/payments", 200, {
    headers: secretHeader,
    pre: freshId ? fresh(event) : "",
    body: `{"eventId":"{{${event}}}","orderId":"{{${id}}}","type":"${type}"}`,
    check: `pm.expect(Object.keys(data).sort()).to.eql(['eventId','orderId','outcome','orderStatus'].sort());pm.expect(data).to.eql({eventId:get('${event}'),orderId:get('${id}'),outcome:'${outcome}',orderStatus:'${status}'});`,
  });
}
function detail(name, id, status, role = "alice", operations = false) {
  request(
    name,
    "GET",
    `${operations ? "/operations" : ""}/orders/{{${id}}}`,
    200,
    {
      role,
      check: `order(data);pm.expect(data).to.include({id:get('${id}'),status:'${status}'});const snapshot=stored('${id}Snapshot');['customerId','productId','productName','quantity','unitPriceMinor','totalMinor','currency','createdAt'].forEach(k=>pm.expect(data[k]).to.eql(snapshot[k]));`,
    },
  );
}
function stock(
  name,
  keyboard = 18,
  hub = 20,
  stand = 20,
  mouse = 20,
  headphones = 1,
) {
  request(name, "GET", "/products", 200, {
    role: "alice",
    check: `productStock('keyboardId',${keyboard});productStock('hubId',${hub});productStock('standId',${stand});productStock('mouseId',${mouse});productStock('headphonesId',${headphones});`,
  });
}
function cancel(name, id, role = "alice") {
  request(name, "POST", `/orders/{{${id}}}/cancel`, 200, {
    role,
    body: {},
    check: `order(data);pm.expect(data).to.include({id:get('${id}'),status:'CANCELLED'});`,
  });
}
section("01 - Login and discover fresh seed");
for (const role of ["alice", "bob", "ops"])
  request(`Login ${role}`, "POST", "/auth/login", 200, {
    body: `{"email":"{{${role}Email}}","password":"{{${role}Password}}"}`,
    pre:
      role === "alice"
        ? `['alice','bob','ops'].forEach(r=>{pm.variables.unset(r+'Token');pm.variables.unset(r+'UserId');});\n['alicePassword','bobPassword','opsPassword','webhookSecret'].forEach(k=>{const v=pm.variables.get(k);if(!v||v.startsWith('REPLACE_'))throw new Error('Configure '+k+' before running.');});`
        : "",
    check: `pm.expect(Object.keys(data).sort()).to.eql(['accessToken','user']);pm.expect(Object.keys(data.user).sort()).to.eql(['email','id','role']);pm.expect(data.accessToken).to.be.a('string').and.have.length.above(20);pm.expect(data.user).to.include({email:get('${role}Email'),role:'${role === "ops" ? "OPERATIONS" : "CUSTOMER"}'});pm.variables.set('${role}Token',data.accessToken);pm.variables.set('${role}UserId',data.user.id);`,
  });
request("Discover exact seeded products", "GET", "/products", 200, {
  role: "alice",
  check: `
pm.expect(Object.keys(data)).to.eql(['items']);pm.expect(data.items).to.have.length(5);
const expected=[['keyboardId','Mechanical Keyboard',1500000,20],['hubId','USB C Hub',800000,20],['standId','Laptop Stand',600000,20],['mouseId','Wireless Mouse',450000,20],['headphonesId','Limited Edition Headphones',2500000,1]];
expected.forEach(([key,name,price,stock])=>{const p=data.items.find(p=>p.name===name);pm.expect(p,'Fresh reset required: '+name).to.exist;pm.expect(Object.keys(p).sort()).to.eql(['id','name','unitPriceMinor','currency','availableQuantity'].sort());pm.expect(p).to.include({unitPriceMinor:price,currency:'LKR',availableQuantity:stock});pm.variables.set(key,p.id);});pm.variables.set('seedProducts',JSON.stringify(data.items));`,
});
request("Fresh customer orders are empty", "GET", "/orders", 200, {
  role: "alice",
  check: "page(data,0);",
});
section("02 - Reserve, retry, conflict and ownership");
create(
  "Create Alice keyboard order",
  "alice",
  "keyboardId",
  "keyboardKey",
  "keyboardOrderId",
  2,
);
request("Identical creation retry", "POST", "/orders", 200, {
  role: "alice",
  headers: keyHeader("keyboardKey"),
  body: createBody("keyboardId", 2),
  check:
    "order(data);pm.expect(data).to.eql(stored('keyboardOrderIdSnapshot'));",
});
for (const [name, product, quantity] of [
  ["Changed quantity conflicts", "keyboardId", 3],
  ["Changed product conflicts", "hubId", 2],
])
  request(name, "POST", "/orders", 409, {
    role: "alice",
    headers: keyHeader("keyboardKey"),
    body: createBody(product, quantity),
    code: "IDEMPOTENCY_CONFLICT",
  });
stock("Stock reserved once despite retry/conflicts");
request("Alice own list", "GET", "/orders", 200, {
  role: "alice",
  check:
    "page(data,1);pm.expect(data.items[0]).to.eql(stored('keyboardOrderIdSnapshot'));",
});
detail("Alice pending detail", "keyboardOrderId", "PENDING");
request(
  "Bob cannot read Alice order",
  "GET",
  "/orders/{{keyboardOrderId}}",
  404,
  { role: "bob", code: "NOT_FOUND" },
);
request(
  "Bob cannot cancel Alice order",
  "POST",
  "/orders/{{keyboardOrderId}}/cancel",
  404,
  { role: "bob", body: {}, code: "NOT_FOUND" },
);
request("Bob own list excludes Alice", "GET", "/orders", 200, {
  role: "bob",
  check: "page(data,0);",
});
for (const [name, role, path] of [
  ["Alice denied operations list", "alice", "/operations/orders"],
  [
    "Bob denied operations detail",
    "bob",
    "/operations/orders/{{keyboardOrderId}}",
  ],
])
  request(name, "GET", path, 403, { role, code: "FORBIDDEN" });
section("03 - Payment success and durable event outcomes");
payment(
  "Payment succeeds",
  "keyboardOrderId",
  "PAYMENT_SUCCEEDED",
  "successEvent",
  "APPLIED",
  "CONFIRMED",
  { freshId: true },
);
payment(
  "Duplicate payment success",
  "keyboardOrderId",
  "PAYMENT_SUCCEEDED",
  "successEvent",
  "DUPLICATE",
  "CONFIRMED",
);
payment(
  "New terminal callback ignored",
  "keyboardOrderId",
  "PAYMENT_FAILED",
  "ignoredSuccessEvent",
  "IGNORED",
  "CONFIRMED",
  { freshId: true },
);
payment(
  "Ignored callback duplicate",
  "keyboardOrderId",
  "PAYMENT_FAILED",
  "ignoredSuccessEvent",
  "DUPLICATE",
  "CONFIRMED",
);
for (const [name, id, type] of [
  ["Changed event type conflicts", "keyboardOrderId", "PAYMENT_FAILED"],
  ["Changed event order conflicts", "unknownOrderId", "PAYMENT_SUCCEEDED"],
])
  request(name, "POST", "/webhooks/payments", 409, {
    headers: secretHeader,
    pre: id === "unknownOrderId" ? fresh(id) : "",
    body: `{"eventId":"{{successEvent}}","orderId":"{{${id}}}","type":"${type}"}`,
    code: "EVENT_ID_CONFLICT",
  });
detail(
  "Confirmed detail has one terminal history",
  "keyboardOrderId",
  "CONFIRMED",
);
request(
  "Terminal cancellation conflicts",
  "POST",
  "/orders/{{keyboardOrderId}}/cancel",
  409,
  { role: "alice", body: {}, code: "INVALID_TRANSITION" },
);
request(
  "Creation retry after payment returns current history",
  "POST",
  "/orders",
  200,
  {
    role: "alice",
    headers: keyHeader("keyboardKey"),
    body: createBody("keyboardId", 2),
    check:
      "order(data);pm.expect(data).to.include({id:get('keyboardOrderId'),status:'CONFIRMED'});",
  },
);
stock("Success retains consumed stock");
section("04 - Failed payment releases stock once");
create("Create Alice hub order", "alice", "hubId", "hubKey", "hubOrderId");
stock("Hub stock reserved", 18, 19);
payment(
  "Payment fails",
  "hubOrderId",
  "PAYMENT_FAILED",
  "failureEvent",
  "APPLIED",
  "FAILED",
  { freshId: true },
);
payment(
  "Duplicate failed payment",
  "hubOrderId",
  "PAYMENT_FAILED",
  "failureEvent",
  "DUPLICATE",
  "FAILED",
);
detail("Failed detail and history", "hubOrderId", "FAILED");
stock("Failure restores hub stock once");
section("05 - Customer cancellation and later callback");
create(
  "Create Alice stand order",
  "alice",
  "standId",
  "standKey",
  "standOrderId",
);
stock("Stand stock reserved", 18, 20, 19);
cancel("Cancel pending stand order", "standOrderId");
request(
  "Repeated cancellation conflicts",
  "POST",
  "/orders/{{standOrderId}}/cancel",
  409,
  { role: "alice", body: {}, code: "INVALID_TRANSITION" },
);
payment(
  "Callback after cancellation ignored",
  "standOrderId",
  "PAYMENT_SUCCEEDED",
  "cancelEvent",
  "IGNORED",
  "CANCELLED",
  { freshId: true },
);
payment(
  "Ignored cancellation event duplicate",
  "standOrderId",
  "PAYMENT_SUCCEEDED",
  "cancelEvent",
  "DUPLICATE",
  "CANCELLED",
);
detail("Cancelled detail and history", "standOrderId", "CANCELLED");
stock("Cancellation restores stand stock once");
create("Create Bob mouse order", "bob", "mouseId", "mouseKey", "mouseOrderId");
section("06 - Operations visibility, filters and pagination");
request("Operations all four orders", "GET", "/operations/orders", 200, {
  role: "ops",
  check:
    "page(data,4);pm.expect([...new Set(data.items.map(o=>o.customerId))].sort()).to.eql([get('aliceUserId'),get('bobUserId')].sort());pm.variables.set('allOrderIds',JSON.stringify(data.items.map(o=>o.id)));",
});
for (const status of ["PENDING", "CONFIRMED", "FAILED", "CANCELLED"])
  request(
    `Operations ${status} filter`,
    "GET",
    `/operations/orders?status=${status}`,
    200,
    {
      role: "ops",
      check: `page(data,1);pm.expect(data.items[0].status).to.eql('${status}');`,
    },
  );
request(
  "Operations first page",
  "GET",
  "/operations/orders?page=1&pageSize=2",
  200,
  {
    role: "ops",
    check:
      "page(data,4,1,2);pm.expect(data.items.map(o=>o.id)).to.eql(stored('allOrderIds').slice(0,2));",
  },
);
request(
  "Operations second page",
  "GET",
  "/operations/orders?page=2&pageSize=2",
  200,
  {
    role: "ops",
    check:
      "page(data,4,2,2);pm.expect(data.items.map(o=>o.id)).to.eql(stored('allOrderIds').slice(2,4));",
  },
);
request(
  "Operations beyond end empty",
  "GET",
  "/operations/orders?page=99&pageSize=2",
  200,
  { role: "ops", check: "page(data,4,99,2);" },
);
detail(
  "Operations inspect Alice history",
  "keyboardOrderId",
  "CONFIRMED",
  "ops",
  true,
);
detail("Operations inspect Bob order", "mouseOrderId", "PENDING", "ops", true);
request("Alice sees only her three orders", "GET", "/orders", 200, {
  role: "alice",
  check:
    "page(data,3);data.items.forEach(o=>pm.expect(o.customerId).to.eql(get('aliceUserId')));",
});
request("Bob sees only his order", "GET", "/orders", 200, {
  role: "bob",
  check:
    "page(data,1);pm.expect(data.items[0].id).to.eql(get('mouseOrderId'));",
});
for (const [name, method, path, body] of [
  ["Operations denied customer list", "GET", "/orders"],
  ["Operations denied customer detail", "GET", "/orders/{{mouseOrderId}}"],
  ["Operations denied create", "POST", "/orders", createBody("mouseId")],
  ["Operations denied cancel", "POST", "/orders/{{mouseOrderId}}/cancel", {}],
])
  request(name, method, path, 403, {
    role: "ops",
    body,
    headers:
      method === "POST" && path === "/orders" ? keyHeader("mouseKey") : [],
    code: "FORBIDDEN",
  });
cancel("Bob cancels his mouse order", "mouseOrderId", "bob");
section("07 - Validation, authentication and unknown resources");
request("Unauthenticated products", "GET", "/products", 401, {
  code: "UNAUTHORIZED",
});
request("Invalid bearer token", "GET", "/orders", 401, {
  headers: [{ key: "Authorization", value: "Bearer invalid" }],
  code: "UNAUTHORIZED",
});
request("Wrong login credentials", "POST", "/auth/login", 401, {
  body: '{"email":"{{aliceEmail}}","password":"wrong-demo-password"}',
  code: "UNAUTHORIZED",
});
for (const [name, q] of [
  ["Zero", 0],
  ["Negative", -1],
  ["Fraction", 1.5],
  ["String", "1"],
  ["Boolean", true],
  ["Null", null],
  ["Unsafe integer", 9007199254740992],
])
  request(`${name} quantity rejected`, "POST", "/orders", 400, {
    role: "alice",
    body: `{"productId":"{{keyboardId}}","quantity":${JSON.stringify(q)}}`,
    pre: fresh("invalidKey"),
    headers: keyHeader("invalidKey"),
    code: "VALIDATION_ERROR",
  });
request("Missing quantity rejected", "POST", "/orders", 400, {
  role: "alice",
  body: '{"productId":"{{keyboardId}}"}',
  headers: keyHeader("invalidKey"),
  code: "VALIDATION_ERROR",
});
request("Client price rejected", "POST", "/orders", 400, {
  role: "alice",
  body: '{"productId":"{{keyboardId}}","quantity":1,"unitPriceMinor":1}',
  headers: keyHeader("invalidKey"),
  code: "VALIDATION_ERROR",
});
request("Missing idempotency header", "POST", "/orders", 400, {
  role: "alice",
  body: createBody("keyboardId"),
  code: "VALIDATION_ERROR",
});
request("Unknown product", "POST", "/orders", 404, {
  role: "alice",
  pre: fresh("unknownProductId") + "\n" + fresh("unknownProductKey"),
  headers: keyHeader("unknownProductKey"),
  body: createBody("unknownProductId"),
  code: "NOT_FOUND",
});
request("Unknown customer order", "GET", "/orders/{{unknownOrderId}}", 404, {
  role: "alice",
  code: "NOT_FOUND",
});
request(
  "Unknown operations order",
  "GET",
  "/operations/orders/{{unknownOrderId}}",
  404,
  { role: "ops", code: "NOT_FOUND" },
);
for (const [name, path, role] of [
  ["Invalid customer page", "/orders?page=0", "alice"],
  ["Invalid operations page size", "/operations/orders?pageSize=101", "ops"],
  ["Lowercase status rejected", "/operations/orders?status=pending", "ops"],
  ["Unknown query rejected", "/orders?customerId=user-bob", "alice"],
  ["Repeated page rejected", "/operations/orders?page=1&page=2", "ops"],
])
  request(name, "GET", path, 400, { role, code: "VALIDATION_ERROR" });
request("Wrong webhook secret", "POST", "/webhooks/payments", 401, {
  headers: [{ key: "X-Webhook-Secret", value: "wrong-demo-secret" }],
  pre: fresh("rejectedEvent"),
  body: '{"eventId":"{{rejectedEvent}}","orderId":"{{standOrderId}}","type":"PAYMENT_FAILED"}',
  code: "UNAUTHORIZED",
});
request("Invalid callback type", "POST", "/webhooks/payments", 400, {
  headers: secretHeader,
  body: '{"eventId":"{{rejectedEvent}}","orderId":"{{standOrderId}}","type":"payment_failed"}',
  code: "VALIDATION_ERROR",
});
request(
  "Unknown callback order does not consume event",
  "POST",
  "/webhooks/payments",
  404,
  {
    headers: secretHeader,
    body: '{"eventId":"{{rejectedEvent}}","orderId":"{{unknownOrderId}}","type":"PAYMENT_FAILED"}',
    code: "NOT_FOUND",
  },
);
payment(
  "Corrected rejected event is accepted",
  "standOrderId",
  "PAYMENT_FAILED",
  "rejectedEvent",
  "IGNORED",
  "CANCELLED",
);
section("08 - Last-unit insufficient stock demonstration");
create(
  "Reserve last headphones unit",
  "alice",
  "headphonesId",
  "headphonesKey",
  "headphonesOrderId",
);
stock("Headphones now unavailable", 18, 20, 20, 20, 0);
request("Bob cannot reserve sold-out headphones", "POST", "/orders", 409, {
  role: "bob",
  pre: fresh("soldOutKey"),
  headers: keyHeader("soldOutKey"),
  body: createBody("headphonesId"),
  code: "INSUFFICIENT_STOCK",
});
cancel("Release headphones reservation", "headphonesOrderId");
section("09 - Final persisted state and unchanged snapshots");
stock("Final stock matches reservation outcomes");
detail("Final confirmed snapshot unchanged", "keyboardOrderId", "CONFIRMED");
request("Final operations state", "GET", "/operations/orders", 200, {
  role: "ops",
  check:
    "page(data,5);pm.expect(data.items.filter(o=>o.status==='CONFIRMED')).to.have.length(1);pm.expect(data.items.filter(o=>o.status==='FAILED')).to.have.length(1);pm.expect(data.items.filter(o=>o.status==='CANCELLED')).to.have.length(3);pm.expect(data.items.filter(o=>o.status==='PENDING')).to.have.length(0);",
});

const collection = {
  info: {
    name: "Inventory assignment - asserted walkthrough",
    description:
      "Our assignment collection. Run all folders in order from a fresh seed. Configure only environment credentials and secret; tokens/products/orders/keys/events are discovered or generated automatically. Examples are captured by the isolated runner and sanitized.",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  item: folders,
};
writeFileSync(destination, JSON.stringify(collection, null, 2) + "\n");
const values = [
  ["baseUrl", "http://localhost:4000/api", "default"],
  ...["alice", "bob", "ops"].flatMap((role) => [
    [role + "Email", role + "@example.test", "default"],
    [role + "Password", "REPLACE_DEMO_PASSWORD", "secret"],
  ]),
  ["webhookSecret", "REPLACE_WEBHOOK_SECRET", "secret"],
];
writeFileSync(
  resolve(directory, "local.postman_environment.json"),
  JSON.stringify(
    {
      name: "Inventory assignment - local placeholders",
      values: values.map(([key, value, type]) => ({
        key,
        value,
        type,
        enabled: true,
      })),
      _postman_variable_scope: "environment",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Generated ${folders.length} folders and ${folders.reduce((n, f) => n + f.item.length, 0)} asserted requests; existing captured examples preserved.`,
);
