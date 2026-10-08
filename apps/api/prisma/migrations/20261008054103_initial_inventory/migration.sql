-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "currency" AS ENUM ('LKR');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "transition_reason" AS ENUM ('ORDER_CREATED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'CUSTOMER_CANCELLED');

-- CreateEnum
CREATE TYPE "payment_event_type" AS ENUM ('PAYMENT_SUCCEEDED', 'PAYMENT_FAILED');

-- CreateEnum
CREATE TYPE "payment_event_outcome" AS ENUM ('APPLIED', 'IGNORED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "currency" "currency" NOT NULL DEFAULT 'LKR',
    "available_quantity" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "total_minor" BIGINT NOT NULL,
    "currency" "currency" NOT NULL DEFAULT 'LKR',
    "status" "order_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_transitions" (
    "order_id" TEXT NOT NULL,
    "sequence" SMALLINT NOT NULL,
    "from_status" "order_status",
    "to_status" "order_status" NOT NULL,
    "reason" "transition_reason" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_transitions_pkey" PRIMARY KEY ("order_id","sequence")
);

-- CreateTable
CREATE TABLE "order_idempotency" (
    "customer_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL,
    "order_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_idempotency_pkey" PRIMARY KEY ("customer_id","key")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "event_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" "payment_event_type" NOT NULL,
    "outcome" "payment_event_outcome",
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "orders_customer_created_id_idx" ON "orders"("customer_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "orders_customer_status_created_id_idx" ON "orders"("customer_id", "status", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "orders_created_id_idx" ON "orders"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "orders_status_created_id_idx" ON "orders"("status", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "orders_product_id_idx" ON "orders"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_idempotency_order_id_key" ON "order_idempotency"("order_id");

-- CreateIndex
CREATE INDEX "payment_events_order_id_idx" ON "payment_events"("order_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_transitions" ADD CONSTRAINT "order_transitions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_idempotency" ADD CONSTRAINT "order_idempotency_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_idempotency" ADD CONSTRAINT "order_idempotency_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL checks are authoritative, including when writes bypass Prisma.
-- BIGINT keeps arithmetic exact; public values must remain safe JSON integers.
ALTER TABLE products
  ADD CONSTRAINT products_price_check CHECK (unit_price_minor BETWEEN 0 AND 9007199254740991),
  ADD CONSTRAINT products_stock_check CHECK (available_quantity BETWEEN 0 AND 9007199254740991);
ALTER TABLE orders
  ADD CONSTRAINT orders_quantity_check CHECK (quantity BETWEEN 1 AND 9007199254740991),
  ADD CONSTRAINT orders_price_check CHECK (unit_price_minor BETWEEN 0 AND 9007199254740991),
  ADD CONSTRAINT orders_total_check CHECK (total_minor BETWEEN 0 AND 9007199254740991 AND total_minor::numeric = quantity::numeric * unit_price_minor::numeric);
ALTER TABLE order_idempotency
  ADD CONSTRAINT order_idempotency_quantity_check CHECK (quantity BETWEEN 1 AND 9007199254740991),
  ADD CONSTRAINT order_idempotency_key_check CHECK (length(btrim(key)) > 0);
ALTER TABLE payment_events
  ADD CONSTRAINT payment_events_event_id_check CHECK (length(btrim(event_id)) > 0);
ALTER TABLE order_transitions
  ADD CONSTRAINT order_transitions_state_check CHECK (
    (sequence = 0 AND from_status IS NULL AND to_status = 'PENDING' AND reason = 'ORDER_CREATED')
    OR
    (sequence = 1 AND from_status IS NOT NULL AND from_status = 'PENDING' AND (
      (to_status = 'CONFIRMED' AND reason = 'PAYMENT_SUCCEEDED') OR
      (to_status = 'FAILED' AND reason = 'PAYMENT_FAILED') OR
      (to_status = 'CANCELLED' AND reason = 'CUSTOMER_CANCELLED')
    ))
  );
