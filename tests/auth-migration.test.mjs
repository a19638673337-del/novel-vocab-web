import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

test('the unbound-code migration preserves ten existing code hashes, a member and its session with foreign keys intact',()=>{
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_open_luckman.sql',import.meta.url),'utf8'));
  const codeInsert=sqlite.prepare('INSERT INTO activation_codes(id,order_number,code_hash,status,created_at) VALUES(?,?,?,?,?)');
  for(let i=1;i<=10;i++)codeInsert.run(`legacy-${i}`,`P20261103-B01-${String(i).padStart(3,'0')}`,String(i).padStart(64,'0'),'available',1000+i);
  codeInsert.run('redeemed-legacy','P20261102-PAID','a'.repeat(64),'used',999);
  sqlite.prepare('INSERT INTO members(id,phone,password_hash,password_salt,password_iterations,activation_code_id,active,created_at) VALUES(?,?,?,?,?,?,?,?)').run('member-1','13800138000','b'.repeat(64),'c'.repeat(32),100000,'redeemed-legacy',1,1000);
  sqlite.prepare('UPDATE activation_codes SET redeemed_by=?,redeemed_at=? WHERE id=?').run('member-1',1000,'redeemed-legacy');
  sqlite.prepare('INSERT INTO member_sessions VALUES(?,?,?,?)').run('d'.repeat(64),'member-1',1000,9000);
  const before=sqlite.prepare('SELECT * FROM activation_codes ORDER BY id').all().map(row=>({...row}));
  const beforeMembers=sqlite.prepare('SELECT * FROM members').all(),beforeSessions=sqlite.prepare('SELECT * FROM member_sessions').all();
  const migrations=readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>name.endsWith('.sql') && !name.startsWith('0000')).sort();
  assert.ok(migrations.length>0,'new migration must add nullable customer order storage');
  for(const file of migrations)sqlite.exec(readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8'));
  const after=sqlite.prepare('SELECT * FROM activation_codes ORDER BY id').all();
  assert.deepEqual(after.map(({customer_order_number,...row})=>row),before);assert.ok(after.every(row=>row.customer_order_number===null));
  assert.deepEqual(sqlite.prepare('SELECT * FROM members').all(),beforeMembers);assert.deepEqual(sqlite.prepare('SELECT * FROM member_sessions').all(),beforeSessions);assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  sqlite.prepare('UPDATE activation_codes SET customer_order_number=? WHERE id=?').run('000001','legacy-1');
  assert.throws(()=>sqlite.prepare('UPDATE activation_codes SET customer_order_number=? WHERE id=?').run('000001','legacy-2'),/UNIQUE/);
  assert.equal(sqlite.prepare('SELECT customer_order_number FROM activation_codes WHERE id=?').get('legacy-2').customer_order_number,null);
  sqlite.close();
});
