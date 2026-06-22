USE jamming_studio;

-- NOTE: kolom `username` dan `email` di tabel users sudah punya UNIQUE constraint,
-- yang otomatis membuat index, jadi tidak perlu index tambahan di sini.
--
-- Index untuk tabel rooms / room_members akan ditambahkan ketika fitur room
-- (src/api/room.js) benar-benar dipakai dan tabelnya dibuat. Dibiarkan kosong
-- agar migrasi tidak gagal karena tabel belum ada.
