import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "./auth.js";

const router = Router();

/**
 * Helper: cek apakah user punya akses (owner/admin)
 */
async function assertRoomOwnerOrAdmin(roomId, user) {
  const rooms = await query(
    "SELECT id, created_by, status FROM rooms WHERE id = ? LIMIT 1",
    [roomId]
  );
  if (rooms.length === 0) return { ok: false, code: 404, message: "Room tidak ditemukan" };

  const room = rooms[0];
  const isOwner = Number(room.created_by) === Number(user.id);
  const isAdmin = user.role === "admin";

  if (!isOwner && !isAdmin) {
    return { ok: false, code: 403, message: "Tidak punya izin" };
  }
  return { ok: true, room };
}

/**
 * POST /api/rooms
 * body: { room_name, agora_channel, max_capacity? }
 */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { room_name, agora_channel, max_capacity } = req.body || {};

    if (!room_name || !agora_channel) {
      return res.status(400).json({ message: "room_name dan agora_channel wajib" });
    }

    const cap = max_capacity == null ? 5 : Number(max_capacity);
    if (!Number.isFinite(cap) || cap < 1 || cap > 50) {
      return res.status(400).json({ message: "max_capacity harus angka 1..50" });
    }

    // bikin room
    const result = await query(
      `INSERT INTO rooms (room_name, agora_channel, max_capacity, status, created_by)
       VALUES (?, ?, ?, 'active', ?)`,
      [room_name, agora_channel, cap, req.user.id]
    );

    const roomId = Number(result.insertId);

    // auto-join creator jadi member pertama
    await query(
      `INSERT INTO room_members (room_id, user_id, joined_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [roomId, req.user.id]
    );

    const rows = await query(
      `SELECT id, room_name, agora_channel, max_capacity, status, created_by, created_at
       FROM rooms WHERE id = ?`,
      [roomId]
    );

    return res.status(201).json({ room: rows[0] });
  } catch (err) {
    console.error("CREATE ROOM ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/rooms
 * query optional: ?status=active|closed (default active)
 */
router.get("/", async (req, res) => {
  try {
    const status = (req.query.status || "active").toString();
    if (!["active", "closed"].includes(status)) {
      return res.status(400).json({ message: "status harus active atau closed" });
    }

    // list room + jumlah member yang sedang join (left_at IS NULL)
    const rows = await query(
      `SELECT
          r.id, r.room_name, r.agora_channel, r.max_capacity, r.status, r.created_by, r.created_at,
          (
            SELECT COUNT(*)
            FROM room_members rm
            WHERE rm.room_id = r.id AND rm.left_at IS NULL
          ) AS active_members
       FROM rooms r
       WHERE r.status = ?
       ORDER BY r.created_at DESC`,
      [status]
    );

    return res.json({ rooms: rows });
  } catch (err) {
    console.error("LIST ROOMS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/rooms/:id
 * detail room + member count
 */
router.get("/:id", async (req, res) => {
  try {
    const roomId = Number(req.params.id);
    if (!Number.isFinite(roomId)) return res.status(400).json({ message: "Room id invalid" });

    const rows = await query(
      `SELECT
          r.id, r.room_name, r.agora_channel, r.max_capacity, r.status, r.created_by, r.created_at,
          (
            SELECT COUNT(*)
            FROM room_members rm
            WHERE rm.room_id = r.id AND rm.left_at IS NULL
          ) AS active_members
       FROM rooms r
       WHERE r.id = ?
       LIMIT 1`,
      [roomId]
    );

    if (rows.length === 0) return res.status(404).json({ message: "Room tidak ditemukan" });
    return res.json({ room: rows[0] });
  } catch (err) {
    console.error("ROOM DETAIL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/rooms/:id/join
 * join room kalau masih active dan kapasitas cukup
 */
router.post("/:id/join", authMiddleware, async (req, res) => {
  try {
    const roomId = Number(req.params.id);
    if (!Number.isFinite(roomId)) return res.status(400).json({ message: "Room id invalid" });

    // cek room exist & active
    const rooms = await query(
      "SELECT id, max_capacity, status FROM rooms WHERE id = ? LIMIT 1",
      [roomId]
    );
    if (rooms.length === 0) return res.status(404).json({ message: "Room tidak ditemukan" });

    const room = rooms[0];
    if (room.status !== "active") {
      return res.status(400).json({ message: "Room sudah closed" });
    }

    // apakah user sudah join (left_at IS NULL)?
    const already = await query(
      `SELECT id FROM room_members
       WHERE room_id = ? AND user_id = ? AND left_at IS NULL
       LIMIT 1`,
      [roomId, req.user.id]
    );
    if (already.length > 0) {
      return res.json({ message: "Sudah join", room_id: roomId });
    }

    // cek kapasitas
    const countRows = await query(
      `SELECT COUNT(*) AS cnt
       FROM room_members
       WHERE room_id = ? AND left_at IS NULL`,
      [roomId]
    );
    const activeCount = Number(countRows[0].cnt);
    if (activeCount >= Number(room.max_capacity)) {
      return res.status(409).json({ message: "Room penuh" });
    }

    // insert member
    await query(
      `INSERT INTO room_members (room_id, user_id, joined_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [roomId, req.user.id]
    );

    return res.status(201).json({ message: "Join berhasil", room_id: roomId });
  } catch (err) {
    console.error("JOIN ROOM ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/rooms/:id/leave
 * set left_at untuk membership aktif
 */
router.post("/:id/leave", authMiddleware, async (req, res) => {
  try {
    const roomId = Number(req.params.id);
    if (!Number.isFinite(roomId)) return res.status(400).json({ message: "Room id invalid" });

    const result = await query(
      `UPDATE room_members
       SET left_at = CURRENT_TIMESTAMP
       WHERE room_id = ? AND user_id = ? AND left_at IS NULL`,
      [roomId, req.user.id]
    );

    // mariadb driver kadang balikin affectedRows via property berbeda, jadi kita amanin
    const affected = Number(result.affectedRows ?? result?.[0]?.affectedRows ?? 0);

    if (affected === 0) {
      return res.status(400).json({ message: "Kamu belum join room ini" });
    }

    return res.json({ message: "Leave berhasil", room_id: roomId });
  } catch (err) {
    console.error("LEAVE ROOM ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/rooms/:id/members
 * list member aktif (left_at IS NULL)
 */
router.get("/:id/members", async (req, res) => {
  try {
    const roomId = Number(req.params.id);
    if (!Number.isFinite(roomId)) return res.status(400).json({ message: "Room id invalid" });

    const rows = await query(
      `SELECT
          u.id, u.display_name, u.username, u.email, u.role, rm.joined_at
       FROM room_members rm
       JOIN users u ON u.id = rm.user_id
       WHERE rm.room_id = ? AND rm.left_at IS NULL
       ORDER BY rm.joined_at ASC`,
      [roomId]
    );

    return res.json({ room_id: roomId, members: rows });
  } catch (err) {
    console.error("ROOM MEMBERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/rooms/:id/close
 * hanya owner/admin yang bisa close
 */
router.post("/:id/close", authMiddleware, async (req, res) => {
  try {
    const roomId = Number(req.params.id);
    if (!Number.isFinite(roomId)) return res.status(400).json({ message: "Room id invalid" });

    const perm = await assertRoomOwnerOrAdmin(roomId, req.user);
    if (!perm.ok) return res.status(perm.code).json({ message: perm.message });

    // close room
    await query("UPDATE rooms SET status = 'closed' WHERE id = ?", [roomId]);

    // auto-leave semua member aktif
    await query(
      `UPDATE room_members
       SET left_at = CURRENT_TIMESTAMP
       WHERE room_id = ? AND left_at IS NULL`,
      [roomId]
    );

    return res.json({ message: "Room ditutup", room_id: roomId });
  } catch (err) {
    console.error("CLOSE ROOM ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;