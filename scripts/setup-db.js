#!/usr/bin/env node
/**
 * HAR Viewer Database Setup
 * Run: node scripts/setup-db.js
 * 
 * Requires PostgreSQL 18 running on port 5432
 */

const { Client } = require('pg');
require('dotenv').config({ path: './apps/api/.env' });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'har_viewer';

async function setup() {
  console.log('🔧 HAR Viewer Database Setup');
  console.log(`📡 Connecting to PostgreSQL at ${DB_HOST}:${DB_PORT}...`);

  // First connect to postgres to create the database
  const adminClient = new Client({
    host: DB_HOST, port: DB_PORT,
    database: 'postgres',
    user: DB_USER, password: DB_PASSWORD,
  });

  try {
    await adminClient.connect();
    console.log('✅ Connected to PostgreSQL');

    // Create database if not exists
    const dbCheck = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]
    );
    if (dbCheck.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`✅ Created database: ${DB_NAME}`);
    } else {
      console.log(`ℹ️  Database already exists: ${DB_NAME}`);
    }
    await adminClient.end();
  } catch (err) {
    console.error('❌ Failed to connect or create database:', err.message);
    console.log('\nTroubleshooting:');
    console.log('  • Make sure PostgreSQL 18 is running on port 5432');
    console.log('  • Check DB_USER and DB_PASSWORD in apps/api/.env');
    console.log('  • Windows: Check EDB PostgreSQL service is started');
    console.log('  • WSL2: Run pg_ctlcluster 18 main start');
    process.exit(1);
  }

  // Connect to the new database and create tables
  const client = new Client({
    host: DB_HOST, port: DB_PORT,
    database: DB_NAME,
    user: DB_USER, password: DB_PASSWORD,
  });

  try {
    await client.connect();
    console.log(`✅ Connected to ${DB_NAME}`);

    console.log('📋 Creating tables...');

    await client.query(`
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
    console.log('  ✅ har_files');

    await client.query(`CREATE INDEX IF NOT EXISTS har_files_uuid_idx ON har_files(uuid)`);
    await client.query(`CREATE INDEX IF NOT EXISTS har_files_status_idx ON har_files(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS har_files_created_idx ON har_files(created_at DESC)`);

    await client.query(`
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
    console.log('  ✅ analysis_jobs');

    await client.query(`
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
    console.log('  ✅ groq_analyses');

    await client.end();

    console.log('\n✅ Database setup complete!');
    console.log('\nNext steps:');
    console.log('  1. Make sure Memurai/Redis is running on port 6379');
    console.log('  2. Add your GROQ_API_KEY to apps/api/.env');
    console.log('  3. Run: npm run dev (from repo root)');
    console.log('  4. Open: http://localhost:3000');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    await client.end();
    process.exit(1);
  }
}

setup();
