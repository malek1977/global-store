/* =====================================================================
 *  GLOBAL STORE — database layer (SQLite via sql.js / WASM)
 *  Persisted to IndexedDB so the whole system is durable & offline-capable.
 * ===================================================================== */
import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import schemaSql from './schema.sql?raw';
import { buildSeed } from './seed';

export type Row = Record<string, any>;

let SQL: any = null;
let db: Database | null = null;
const listeners = new Set<() => void>();

/* ---------------------------------------------------------- IndexedDB */
const DB_NAME = 'global-store';
const STORE = 'main';

let idbBroken = false;

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (idbBroken || typeof indexedDB === 'undefined') return reject(new Error('indexeddb_unavailable'));
    try {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => { idbBroken = true; reject(r.error ?? new Error('indexeddb_error')); };
      r.onblocked = () => reject(new Error('indexeddb_blocked'));
    } catch (e) {
      idbBroken = true;
      reject(e as Error);
    }
  });
}

async function idbGet(key: string): Promise<ArrayBuffer | undefined> {
  try {
    const d = await idb();
    return await new Promise((resolve, reject) => {
      const t = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      t.onsuccess = () => resolve(t.result);
      t.onerror = () => reject(t.error);
    });
  } catch {
    return undefined;               // first run, private mode, or storage disabled
  }
}

async function idbPut(key: string, val: ArrayBuffer): Promise<void> {
  try {
    const d = await idb();
    await new Promise<void>((resolve, reject) => {
      const t = d.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key);
      t.onsuccess = () => resolve();
      t.onerror = () => reject(t.error);
    });
  } catch {
    idbBroken = true;               // keep running in memory rather than crash
  }
}

export async function idbClear(): Promise<void> {
  try {
    const d = await idb();
    await new Promise<void>((resolve, reject) => {
      const t = d.transaction(STORE, 'readwrite').objectStore(STORE).clear();
      t.onsuccess = () => resolve();
      t.onerror = () => reject(t.error);
    });
  } catch { /* storage unavailable — nothing to clear */ }
}

/* ------------------------------------------------------------- engine */
let initError: string | null = null;
export const getInitError = () => initError;

export async function initDB(): Promise<Database> {
  if (db) return db;
  try {
    SQL = await initSqlJs({ locateFile: () => wasmUrl });
  } catch (e: any) {
    initError = `wasm_init_failed: ${e?.message ?? e}`;
    throw e;
  }

  const saved = await idbGet('db').catch(() => undefined);
  if (saved) {
    db = new SQL.Database(new Uint8Array(saved));
    // A snapshot is only usable if it is COMPLETE. A half-written seed
    // (app_meta present but users missing) would leave the system with no
    // login accounts, so we verify the users table before trusting it.
    const meta = q<{ v: number }>('SELECT COUNT(*) AS v FROM app_meta')[0]?.v ?? 0;
    const users = q<{ v: number }>('SELECT COUNT(*) AS v FROM users')[0]?.v ?? 0;
    const products = q<{ v: number }>('SELECT COUNT(*) AS v FROM products')[0]?.v ?? 0;
    if (!meta || !users || !products) { db.close(); db = null; }
  }

  if (!db) {
    db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON;');
    db.run(schemaSql);
    await buildSeed(db);          // MUST be awaited: PBKDF2 hashing of the demo
    await persist();              // users is slow — persisting early stores a partial DB
  }
  return db!;
}

export function getDB(): Database {
  if (!db) throw new Error('Database not initialised');
  return db;
}

/* ------------------------------------------------------------ queries */
export function q<T = Row>(sql: string, params: SqlValue[] = []): T[] {
  const stmt = getDB().prepare(sql);
  try {
    stmt.bind(params as any);
    const out: T[] = [];
    while (stmt.step()) out.push(stmt.getAsObject() as T);
    return out;
  } finally {
    stmt.free();
  }
}

export function one<T = Row>(sql: string, params: SqlValue[] = []): T | null {
  return q<T>(sql, params)[0] ?? null;
}

export function scalar<T = number>(sql: string, params: SqlValue[] = []): T {
  const r = one<any>(sql, params);
  if (!r) return 0 as unknown as T;
  return Object.values(r)[0] as T;
}

/** Run a mutation inside a transaction and persist + notify. */
export function tx(fn: (d: Database) => void): void {
  const d = getDB();
  d.run('BEGIN');
  try {
    fn(d);
    d.run('COMMIT');
  } catch (e) {
    d.run('ROLLBACK');
    throw e;
  }
  void persist();
  emit();
}

/** Fire-and-forget mutation (single statement). */
export function run(sql: string, params: SqlValue[] = []): void {
  tx(() => {
    getDB().run(sql, params as any);
  });
}

/** Prepared INSERT helper -> returns new row id. */
export function insert(table: string, data: Row): number {
  const keys = Object.keys(data);
  if (!keys.length) throw new Error('insert: no columns');
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  tx(() => {
    getDB().run(sql, keys.map((k) => data[k] ?? null) as any);
  });
  return scalar<number>('SELECT last_insert_rowid() AS id');
}

export function update(table: string, id: number, data: Row): void {
  const keys = Object.keys(data);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`;
  run(sql, [...keys.map((k) => data[k] ?? null), id] as any);
}

export function remove(table: string, id: number): void {
  run(`DELETE FROM ${table} WHERE id=?`, [id]);
}

/* --------------------------------------------------------- persistence */
let persistTimer: any = null;
export async function persist(): Promise<void> {
  if (!db) return;
  try {
    await idbPut('db', db.export() as ArrayBuffer);
  } catch (e) {
    console.warn('[db] persistence unavailable, running in-memory', e);
  }
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => void persist(), 250);
}

/* -------------------------------------------------------- subscriptions */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((f) => f());
}

/* ------------------------------------------------------------- export */
export function exportDatabase(): Uint8Array {
  return getDB().export();
}

export function importDatabase(bytes: Uint8Array): void {
  if (!SQL) throw new Error('engine not ready');
  const next = new SQL.Database(bytes);
  try {
    if (!next.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='app_meta'")[0]) {
      next.close();
      throw new Error('ملف غير صالح: ليس قاعدة بيانات جلوبال ستور');
    }
  } catch (e) {
    next.close();
    throw e;
  }
  db?.close();
  db = next;
  db.run('PRAGMA foreign_keys = ON;');
  schedulePersist();
  void persist();
  emit();
}

export async function hardReset(): Promise<void> {
  if (!SQL) return;
  db?.close();
  db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');
  db.run(schemaSql);
  await buildSeed(db);
  await persist();
  emit();
}

/** Subscribe the persistence layer to every mutation. */
export const persistHook = schedulePersist;
