import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,     // 127.0.0.1
  user: process.env.DB_USER,     // root
  password: process.env.DB_PASSWORD, // root (docker)
  database: process.env.DB_NAME, // jamming_studio
  port: process.env.DB_PORT      // 3307 (docker)
});

db.connect((err) => {
  if (err) {
    console.error(" DB Error:", err);
  } else {
    console.log(" DB Connected!");
  }
});

export default db;