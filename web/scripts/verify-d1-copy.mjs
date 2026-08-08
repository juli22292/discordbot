const API_ROOT = "https://api.cloudflare.com/client/v4";
const INTERNAL_NAME_PREFIXES = ["_cf_", "sqlite_"];

const requiredEnvironment = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "OLD_DATABASE_ID",
  "NEW_DATABASE_ID"
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`Missing environment variable: ${name}`);
  }
}

const mode = process.argv[2];
if (mode !== "preflight" && mode !== "verify") {
  throw new Error("Usage: node scripts/verify-d1-copy.mjs <preflight|verify>");
}

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const oldDatabaseId = process.env.OLD_DATABASE_ID;
const newDatabaseId = process.env.NEW_DATABASE_ID;

async function query(databaseId, sql) {
  const response = await fetch(
    `${API_ROOT}/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sql })
    }
  );

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    const details = payload.errors?.map((entry) => entry.message).join("; ") || response.statusText;
    throw new Error(`Cloudflare D1 query failed (${response.status}): ${details}`);
  }

  const statement = payload.result?.[0];
  if (!statement?.success) {
    throw new Error("Cloudflare D1 returned an unsuccessful SQL statement.");
  }

  return statement.results ?? [];
}

function isUserObject(name) {
  return !INTERNAL_NAME_PREFIXES.some((prefix) => name.startsWith(prefix));
}

async function schema(databaseId) {
  const rows = await query(
    databaseId,
    "SELECT name, type, sql FROM sqlite_schema ORDER BY type, name"
  );

  return rows.filter((row) => isUserObject(String(row.name ?? "")));
}

function normalizeSql(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function tableCount(databaseId, tableName) {
  const rows = await query(
    databaseId,
    `SELECT COUNT(*) AS row_count FROM ${quoteIdentifier(tableName)}`
  );
  return Number(rows[0]?.row_count ?? -1);
}

if (mode === "preflight") {
  const targetSchema = await schema(newDatabaseId);
  if (targetSchema.length > 0) {
    const names = targetSchema.map((entry) => entry.name).join(", ");
    throw new Error(`Target database is not empty. Found: ${names}`);
  }

  console.log("Target database is empty. Migration can start safely.");
  process.exit(0);
}

const [sourceSchema, targetSchema] = await Promise.all([
  schema(oldDatabaseId),
  schema(newDatabaseId)
]);

const targetByKey = new Map(
  targetSchema.map((entry) => [`${entry.type}:${entry.name}`, entry])
);

for (const sourceEntry of sourceSchema) {
  const key = `${sourceEntry.type}:${sourceEntry.name}`;
  const targetEntry = targetByKey.get(key);
  if (!targetEntry) {
    throw new Error(`Target schema is missing ${key}.`);
  }

  if (normalizeSql(sourceEntry.sql) !== normalizeSql(targetEntry.sql)) {
    throw new Error(`Schema differs for ${key}.`);
  }

  targetByKey.delete(key);
}

if (targetByKey.size > 0) {
  throw new Error(`Target schema contains unexpected objects: ${[...targetByKey.keys()].join(", ")}`);
}

const tables = sourceSchema
  .filter((entry) => entry.type === "table")
  .map((entry) => String(entry.name));

for (const tableName of tables) {
  const [sourceCount, targetCount] = await Promise.all([
    tableCount(oldDatabaseId, tableName),
    tableCount(newDatabaseId, tableName)
  ]);

  if (sourceCount !== targetCount) {
    throw new Error(
      `Row count differs for ${tableName}: source=${sourceCount}, target=${targetCount}`
    );
  }

  console.log(`${tableName}: ${sourceCount} rows`);
}

console.log(`Verified ${sourceSchema.length} schema objects and ${tables.length} tables.`);
