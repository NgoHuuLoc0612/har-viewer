import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

async function migrate() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'har_viewer',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  const db = drizzle(pool);

  console.log('Creating HAR Viewer database tables...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS har_files (
      id SERIAL PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      file_path TEXT,
      file_size BIGINT,
      md5_hash VARCHAR(32),
      sha256_hash VARCHAR(64),
      har_version VARCHAR(20),
      creator_name TEXT,
      creator_version TEXT,
      browser_name TEXT,
      browser_version TEXT,
      generated_timestamp TEXT,
      export_timestamp TEXT,
      page_count INTEGER DEFAULT 0,
      entry_count INTEGER DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      unique_url_count INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'pending',
      error_message TEXT,
      raw_data JSONB,
      analysis_data JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS har_files_uuid_idx ON har_files(uuid)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS har_files_status_idx ON har_files(status)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id SERIAL PRIMARY KEY,
      har_file_id INTEGER NOT NULL,
      job_id TEXT,
      status VARCHAR(20) DEFAULT 'queued',
      progress INTEGER DEFAULT 0,
      error_message TEXT,
      result JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS groq_analyses (
      id SERIAL PRIMARY KEY,
      har_file_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      analysis_type VARCHAR(50),
      prompt TEXT,
      result TEXT,
      tokens_used INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log('Migration complete!');
  await pool.end();
}

migrate().catch(console.error);
