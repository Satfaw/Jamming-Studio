CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_room_members_room ON room_members(room_id);