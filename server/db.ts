import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DatabaseSync as TipoDatabaseSync } from 'node:sqlite';

// Se carga con require para que las herramientas de pruebas (Vite) no intenten resolver el módulo.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

export type Db = TipoDatabaseSync;

export function abrirDb(ruta: string): Db {
  if (ruta !== ':memory:') fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      hash TEXT NOT NULL,
      creado TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS disenos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      producto_id INTEGER,
      config TEXT NOT NULL,
      miniatura TEXT,
      creado TEXT NOT NULL DEFAULT (datetime('now')),
      actualizado TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS disenos_usuario ON disenos(usuario_id, actualizado DESC);

    CREATE TABLE IF NOT EXISTS cotizaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      nombre TEXT,
      telefono TEXT,
      comentario TEXT,
      producto_id INTEGER,
      config TEXT NOT NULL,
      resumen TEXT NOT NULL,
      creado TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}
