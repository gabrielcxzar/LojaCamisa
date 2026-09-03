import { AsyncLocalStorage } from "node:async_hooks";

import postgres, { type Sql } from "postgres";

declare global {
  var __lojaCamisaPgClient: Sql | undefined;
}

type DbParam = string | number | boolean | null | undefined | Date;

type QueryExecutor = {
  query<T extends Record<string, unknown>>(query: string, params: DbParam[]): Promise<T[]>;
  exec(query: string): Promise<void>;
};

const schemaSql = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    line1 TEXT NOT NULL,
    line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT,
    country TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    team TEXT NOT NULL,
    model TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    base_price DOUBLE PRECISION NOT NULL,
    active INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    active INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS import_packages (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    supplier_id TEXT,
    package_quantity INTEGER NOT NULL DEFAULT 0,
    product_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    extra_fees DOUBLE PRECISION NOT NULL DEFAULT 0,
    internal_shipping DOUBLE PRECISION NOT NULL DEFAULT 0,
    tracking_code TEXT UNIQUE,
    carrier TEXT,
    origin_country TEXT,
    paid_at TEXT,
    notes TEXT,
    last_status TEXT,
    last_update_at TEXT,
    eta_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  ALTER TABLE import_packages
    ADD COLUMN IF NOT EXISTS package_quantity INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE import_packages
    ADD COLUMN IF NOT EXISTS product_cost DOUBLE PRECISION NOT NULL DEFAULT 0;
  ALTER TABLE import_packages
    ADD COLUMN IF NOT EXISTS extra_fees DOUBLE PRECISION NOT NULL DEFAULT 0;
  ALTER TABLE import_packages
    ADD COLUMN IF NOT EXISTS internal_shipping DOUBLE PRECISION NOT NULL DEFAULT 0;
  ALTER TABLE import_packages
    ADD COLUMN IF NOT EXISTS tracking_code TEXT;
  ALTER TABLE import_packages
    ADD COLUMN IF NOT EXISTS carrier TEXT;
  ALTER TABLE import_packages
    ADD COLUMN IF NOT EXISTS origin_country TEXT;
  ALTER TABLE import_packages
    ADD COLUMN IF NOT EXISTS paid_at TEXT;
  ALTER TABLE import_packages
    ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE import_packages
    ADD COLUMN IF NOT EXISTS last_status TEXT;
  ALTER TABLE import_packages
    ADD COLUMN IF NOT EXISTS last_update_at TEXT;
  ALTER TABLE import_packages
    ADD COLUMN IF NOT EXISTS eta_date TEXT;

  CREATE TABLE IF NOT EXISTS order_packages (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    package_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (package_id) REFERENCES import_packages(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    address_id TEXT NOT NULL,
    status TEXT NOT NULL,
    payment_type TEXT NOT NULL,
    total_amount DOUBLE PRECISION NOT NULL,
    amount_paid DOUBLE PRECISION NOT NULL,
    is_personal_use INTEGER NOT NULL DEFAULT 0,
    is_stock_order INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (address_id) REFERENCES addresses(id)
  );

  ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS is_personal_use INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS is_stock_order INTEGER NOT NULL DEFAULT 0;

  CREATE TABLE IF NOT EXISTS internal_stock_allocations (
    id TEXT PRIMARY KEY,
    source_order_id TEXT NOT NULL,
    sale_order_id TEXT NOT NULL UNIQUE,
    supplier_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (source_order_id) REFERENCES orders(id),
    FOREIGN KEY (sale_order_id) REFERENCES orders(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT,
    item_name TEXT,
    item_description TEXT,
    size TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DOUBLE PRECISION NOT NULL,
    total_price DOUBLE PRECISION NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  ALTER TABLE order_items
    ALTER COLUMN product_id DROP NOT NULL;
  ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS item_name TEXT;
  ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS item_description TEXT;

  CREATE TABLE IF NOT EXISTS supplier_orders (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    supplier_id TEXT NOT NULL,
    product_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    extra_fees DOUBLE PRECISION NOT NULL DEFAULT 0,
    package_quantity INTEGER NOT NULL DEFAULT 0,
    unit_cost DOUBLE PRECISION NOT NULL,
    total_cost DOUBLE PRECISION NOT NULL,
    paid_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  ALTER TABLE supplier_orders
    ADD COLUMN IF NOT EXISTS product_cost DOUBLE PRECISION NOT NULL DEFAULT 0;
  ALTER TABLE supplier_orders
    ADD COLUMN IF NOT EXISTS extra_fees DOUBLE PRECISION NOT NULL DEFAULT 0;
  ALTER TABLE supplier_orders
    ADD COLUMN IF NOT EXISTS package_quantity INTEGER NOT NULL DEFAULT 0;

  CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    tracking_code TEXT NOT NULL,
    carrier TEXT NOT NULL,
    origin_country TEXT NOT NULL,
    eta_date TEXT,
    last_status TEXT,
    last_update_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS order_status_history (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    method TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS action_logs (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    order_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_import_packages_tracking_code ON import_packages(tracking_code);
  CREATE INDEX IF NOT EXISTS idx_order_packages_package_id ON order_packages(package_id);
  CREATE INDEX IF NOT EXISTS idx_internal_stock_source ON internal_stock_allocations(source_order_id);
  CREATE INDEX IF NOT EXISTS idx_internal_stock_sale ON internal_stock_allocations(sale_order_id);
  CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
  CREATE INDEX IF NOT EXISTS idx_logs_order_id ON action_logs(order_id);
`;

const performanceIndexesSql = `
  CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_tracking_code ON shipments(tracking_code);
  CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
  CREATE INDEX IF NOT EXISTS idx_payments_direction_created_at ON payments(direction, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
  CREATE INDEX IF NOT EXISTS idx_supplier_orders_order_id ON supplier_orders(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_packages_order_id ON order_packages(order_id);
  CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_address_id ON orders(address_id);
`;

function normalizeParam(param: DbParam): string | number | boolean | null {
  if (param === undefined) return null;
  if (param instanceof Date) return param.toISOString();
  return param;
}

function replacePositionalParams(query: string) {
  let index = 0;
  return query.replace(/\?/g, () => `$${++index}`);
}

const rawDatabaseUrl = process.env.DATABASE_URL ?? "";

function getDatabaseUrl() {
  if (!rawDatabaseUrl || rawDatabaseUrl.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL precisa ser uma URL PostgreSQL (Supabase). Exemplo: postgres://user:pass@host:5432/postgres",
    );
  }
  return rawDatabaseUrl;
}

function sanitizeDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port}${parsed.pathname}`;
  } catch {
    return "DATABASE_URL invalida";
  }
}

export const dbPath = rawDatabaseUrl
  ? sanitizeDatabaseUrl(rawDatabaseUrl)
  : "DATABASE_URL nao configurada";

const queryContext = new AsyncLocalStorage<QueryExecutor>();

let postgresClient: Sql | null = null;
let schemaInitialized = false;
let schemaInitPromise: Promise<void> | null = null;

async function isSchemaReady(client: Sql) {
  const result = await client.unsafe<
    Array<{
      orders_ready: boolean;
      supplier_orders_ready: boolean;
      import_packages_ready: boolean;
      internal_stock_ready: boolean;
    }>
  >(
    `
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'orders'
          AND column_name = 'is_stock_order'
      ) AS orders_ready,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'supplier_orders'
          AND column_name = 'package_quantity'
      ) AS supplier_orders_ready,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'import_packages'
          AND column_name = 'internal_shipping'
      ) AS import_packages_ready,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'internal_stock_allocations'
      ) AS internal_stock_ready
    `,
  );

  const row = result[0];
  return Boolean(
    row?.orders_ready &&
      row?.supplier_orders_ready &&
      row?.import_packages_ready &&
      row?.internal_stock_ready,
  );
}

function getPostgresClient() {
  if (!postgresClient) {
    const poolMax = Number(process.env.DB_POOL_MAX ?? 5);
    const safePoolMax = Number.isFinite(poolMax)
      ? Math.max(1, Math.min(poolMax, 20))
      : 5;

    const existingClient =
      process.env.NODE_ENV === "production" ? undefined : globalThis.__lojaCamisaPgClient;

    postgresClient = existingClient ?? postgres(getDatabaseUrl(), {
      max: safePoolMax,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: "require",
    });

    if (process.env.NODE_ENV !== "production" && !globalThis.__lojaCamisaPgClient) {
      globalThis.__lojaCamisaPgClient = postgresClient;
    }
  }
  return postgresClient;
}

export async function initSchema() {
  if (schemaInitialized) return;
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      const client = getPostgresClient();
      const ready = await isSchemaReady(client);
      if (ready) {
        schemaInitialized = true;
        return;
      }

      await client.unsafe(schemaSql);
      await client.unsafe(performanceIndexesSql);
      schemaInitialized = true;
    })();
  }
  await schemaInitPromise;
}

export async function ensurePerformanceIndexes() {
  const client = getPostgresClient();
  await client.unsafe(performanceIndexesSql);
}

function baseExecutor(): QueryExecutor {
  return {
    async query<T extends Record<string, unknown>>(query: string, params: DbParam[]) {
      const client = getPostgresClient();
      const pgQuery = replacePositionalParams(query);
      const rows = await client.unsafe(
        pgQuery,
        params.map(normalizeParam),
      );
      return rows as unknown as T[];
    },
    async exec(query: string) {
      const client = getPostgresClient();
      await client.unsafe(query);
    },
  };
}

function activeExecutor() {
  return queryContext.getStore() ?? baseExecutor();
}

async function runInTransaction<T>(fn: () => Promise<T> | T): Promise<T> {
  const root = getPostgresClient();
  const value = await root.begin(async (transactionClient) => {
    const transactionExecutor: QueryExecutor = {
      async query<T extends Record<string, unknown>>(query: string, params: DbParam[]) {
        const pgQuery = replacePositionalParams(query);
        const rows = await transactionClient.unsafe(
          pgQuery,
          params.map(normalizeParam),
        );
        return rows as unknown as T[];
      },
      async exec(query: string) {
        await transactionClient.unsafe(query);
      },
    };

    return queryContext.run(transactionExecutor, async () => fn());
  });
  return value as T;
}

export const db = {
  prepare<T extends Record<string, unknown>>(query: string) {
    return {
      all: async (...params: DbParam[]) => activeExecutor().query<T>(query, params),
      get: async (...params: DbParam[]) => {
        const rows = await activeExecutor().query<T>(query, params);
        return rows[0];
      },
      run: async (...params: DbParam[]) => {
        await activeExecutor().query(query, params);
      },
    };
  },
  exec: async (query: string) => {
    await activeExecutor().exec(query);
  },
  transaction<T>(fn: () => Promise<T> | T) {
    return async () => runInTransaction(fn);
  },
};
