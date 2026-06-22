import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// .env ada di folder yang sama (src/backend/.env)
dotenv.config({ path: path.resolve(__dirname, ".env") });
// folder schema: <repo>/database/schema
const SCHEMA_DIR = path.resolve(__dirname, "../../database/schema");

// Daftar file yang dijalankan berurutan. Bisa dioverride lewat env SQL_FILE.
const SQL_FILES = process.env.SQL_FILE
  ? [process.env.SQL_FILE]
  : ["001_init.sql", "002_indexes.sql"];

function splitSqlStatements(sql) {
  const noBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/^\s*--.*$/gm, "");
  return noLineComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD ?? "";

  let conn;
  try {
    conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
    });

    console.log(`[migration] Connected to ${host}:${port} as ${user}`);

    for (const file of SQL_FILES) {
      const sqlPath = path.resolve(SCHEMA_DIR, file);
      if (!fs.existsSync(sqlPath)) {
        console.warn(`[migration] Skip, file not found: ${sqlPath}`);
        continue;
      }
      const sql = fs.readFileSync(sqlPath, "utf8");
      const statements = splitSqlStatements(sql);
      console.log(`[migration] Running ${statements.length} statements from ${file}...`);
      for (const stmt of statements) {
        await conn.query(stmt);
      }
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
