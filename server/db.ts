import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DatabaseSync as TipoDatabaseSync } from 'node:sqlite';

// Se carga con require para que las herramientas de pruebas (Vite) no intenten resolver el módulo.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

export type Db = TipoDatabaseSync;

function columnas(db: Db, tabla: string): string[] {
  return (db.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string }[]).map((c) => c.name);
}

export function abrirDb(ruta: string): Db {
  if (ruta !== ':memory:') fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- Cuentas de los vendedores.
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      hash TEXT NOT NULL,
      creado TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  if (!columnas(db, 'usuarios').includes('telefono')) db.exec('ALTER TABLE usuarios ADD COLUMN telefono TEXT');

  // La primera versión guardaba cotizaciones de clientes sin vendedor: se archivan.
  const previas = columnas(db, 'cotizaciones');
  if (previas.length && !previas.includes('vendedor_id')) db.exec('ALTER TABLE cotizaciones RENAME TO cotizaciones_v1');

  db.exec(`
    -- Cotizaciones y ventas registradas por cada vendedor.
    CREATE TABLE IF NOT EXISTS cotizaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendedor_id INTEGER NOT NULL REFERENCES usuarios(id),
      cliente_nombre TEXT NOT NULL,
      cliente_telefono TEXT,
      cliente_email TEXT,
      cliente_direccion TEXT,
      observaciones TEXT,
      producto_id INTEGER,
      modelo TEXT NOT NULL,
      config TEXT NOT NULL,
      detalle TEXT NOT NULL,
      miniatura TEXT,
      valor INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'cotizada' CHECK (estado IN ('cotizada', 'vendida', 'anulada')),
      fecha_venta TEXT,
      valor_venta INTEGER,
      medio_pago TEXT,
      nota_venta TEXT,
      creado TEXT NOT NULL DEFAULT (datetime('now')),
      actualizado TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS cotizaciones_vendedor ON cotizaciones(vendedor_id, fecha DESC, id DESC);
  `);
  return db;
}
