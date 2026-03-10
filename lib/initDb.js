import pool from "./db";

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS photos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      uploaded_by VARCHAR(50) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      storage_path TEXT,
      uploaded_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS albums (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_by VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS album_photos (
      id SERIAL PRIMARY KEY,
      album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
      photo_id INTEGER REFERENCES photos(id) ON DELETE CASCADE,
      added_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(album_id, photo_id)
    );
  `);
}