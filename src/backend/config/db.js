import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// .env ada di src/backend/.env (satu folder di atas config/)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const db = mysql.createPool({
  host: process.env.DB_HOST,         // 127.0.0.1
  user: process.env.DB_USER,         // root
  password: process.env.DB_PASSWORD, // password MySQL lokal
  database: process.env.DB_NAME,     // jamming_studio
  port: Number(process.env.DB_PORT), // 3306 (MySQL lokal)
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Cek koneksi sekali saat startup biar kelihatan kalau salah config
db.getConnection()
  .then((conn) => {
    console.log("✅ DB Connected!");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ DB Error:", err.message);
  });

export default db;
