import db from "../config/db.js";
import bcrypt from "bcrypt";

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { display_name, username, email, password } = req.body || {};

    if (!display_name || !username || !email || !password) {
      return res
        .status(400)
        .json({ message: "Nama lengkap, username, email, dan password wajib diisi" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password minimal 6 karakter" });
    }

    // cek duplikat username / email
    const [existing] = await db.query(
      "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
      [username, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: "Username atau email sudah dipakai" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "INSERT INTO users (display_name, username, email, password) VALUES (?, ?, ?, ?)",
      [display_name, username, email, hashedPassword]
    );

    const [rows] = await db.query(
      "SELECT id, display_name, username, email, created_at FROM users WHERE id = ?",
      [result.insertId]
    );

    return res.status(201).json({ message: "Register berhasil", user: rows[0] });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Username atau email sudah dipakai" });
    }
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ message: "Username dan password wajib diisi" });
    }

    // username bisa diisi username ATAU email
    const [rows] = await db.query(
      "SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1",
      [username, username]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "User tidak ditemukan" });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ message: "Password salah" });
    }

    // jangan kirim password balik ke client
    const safeUser = {
      id: user.id,
      display_name: user.display_name,
      username: user.username,
      email: user.email,
      created_at: user.created_at,
    };

    return res.json({ message: "Login berhasil", user: safeUser });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
