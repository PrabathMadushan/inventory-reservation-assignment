-- An immediate FK check acquires order KEY SHARE during event INSERT.
-- Two callbacks then upgrading to FOR UPDATE can deadlock each other.
-- Keep referential integrity at commit without a premature order-row lock.
ALTER TABLE payment_events
  ALTER CONSTRAINT payment_events_order_id_fkey DEFERRABLE INITIALLY DEFERRED;
