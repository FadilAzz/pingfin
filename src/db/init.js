const fs   = require('fs');
const path = require('path');
const mysql  = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function main() {
  const dbName = process.env.DB_NAME || 'pingfin';

  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('> Running schema.sql...');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await conn.query(schema);

  console.log('> Creating default admin user...');
  const username = process.env.DEFAULT_USER || 'admin';
  const password = process.env.DEFAULT_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(password, 10);
  await conn.query(
    'INSERT IGNORE INTO pingfin.users (username, password_hash, role) VALUES (?, ?, ?)',
    [username, hash, 'admin']
  );

  console.log(`> Done! Login: ${username} / ${password}`);
  await conn.end();
}

main().catch((err) => { console.error('DB init failed:', err); process.exit(1); });
