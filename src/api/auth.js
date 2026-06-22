import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { query } from "../db.js";

dotenv.config();

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function signToken(user) {
  // simpen yang perlu aja, jangan jadiin token tempat naruh dosa
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing Bearer token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // {id, role, username, iat, exp}
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { display_name, username, email, password } = req.body || {};

    if (!display_name || !username || !email || !password) {
      return res.status(400).json({ message: "display_name, username, email, password wajib" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password minimal 6 karakter" });
    }

    // cek unique
    const existing = await query(
      "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
      [username, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: "Username atau email sudah dipakai" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (display_name, username, email, password_hash, role)
       VALUES (?, ?, ?, ?, 'user')`,
      [display_name, username, email, password_hash]
    );

    const userId = Number(result.insertId);
    const rows = await query(
      "SELECT id, display_name, username, email, role, created_at FROM users WHERE id = ?",
      [userId]
    );
    const user = rows[0];

    const token = signToken(user);

    return res.status(201).json({ user, token });
  } catch (err) {
    // kalau errornya duplicate key dari DB
    if (String(err?.code || "").includes("ER_DUP_ENTRY")) {
      return res.status(409).json({ message: "Username atau email sudah dipakai" });
    }
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    // identifier bisa username atau email
    if (!identifier || !password) {
      return res.status(400).json({ message: "identifier dan password wajib" });
    }

    const rows = await query(
      `SELECT id, display_name, username, email, password_hash, role, created_at
       FROM users
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [identifier, identifier]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Login gagal" });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Login gagal" });
    }

    const token = signToken(user);

    // jangan kirim password_hash balik
    const safeUser = {
      id: user.id,
      display_name: user.display_name,
      username: user.username,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    };

    return res.json({ user: safeUser, token });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/me (cek token)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      "SELECT id, display_name, username, email, role, created_at FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    return res.json({ user: rows[0] });
  } catch (err) {
    console.error("ME ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
export { authMiddleware };