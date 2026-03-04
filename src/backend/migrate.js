import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as mariadb from "mariadb";   // ✅ ini yang bener untuk ESM
import dotenv from "dotenv";

dotenv.config();

const SQL_FILE = process.env.SQL_FILE || "001_init.sql";

function splitSqlStatements(sql) {
  const noBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/^\s*--.*$/gm, "");
  return noLineComments
    .split(";")
    .map(s => s.trim())
    .filter(Boolean);
}

async function main() {
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD ?? "";

  const sqlPath = path.resolve(process.cwd(), SQL_FILE);
  if (!fs.existsSync(sqlPath)) {
    console.error(`[migration] SQL file not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const statements = splitSqlStatements(sql);

  let conn;
  try {
    conn = await mariadb.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });

    console.log(`[migration] Connected to ${host}:${port} as ${user}`);
    console.log(`[migration] Running ${statements.length} statements from ${SQL_FILE}...`);

    for (const stmt of statements) {
      await conn.query(stmt);
    }

    console.log("[migration] Done.");
  } catch (err) {
    console.error("[migration] Failed:", err?.message || err);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
}

main();