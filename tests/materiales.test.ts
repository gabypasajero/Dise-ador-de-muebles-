import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CatalogoMateriales, Material } from '../shared/tipos';

const RUTA = 'public/datos/materiales.json';
const catalogo = JSON.parse(fs.readFileSync(RUTA, 'utf8')) as CatalogoMateriales;
const grupos = { melaminas: catalogo.melaminas, cubiertas: catalogo.cubiertas, tiradores: catalogo.tiradores };

const MELAMINAS_COCINA = ['gris-blanqueado', 'pino-casina', 'pino-nebraska', 'verde-salvia', 'rojo'];
const CUBIERTAS_OFICIALES = ['clasic', 'florentino', 'granito', 'granito-beige', 'calacatta', 'granito-negro'];
const TIPOS = ['liso', 'madera', 'marmol', 'granito', 'concreto'];

function porId(lista: Material[], id: string): Material {
  const m = lista.find((x) => x.id === id);
  if (!m) throw new Error(`falta ${id}`);
  return m;
}

/** Ancho y alto de un JPG (lee el marcador SOF). */
function tamanoJpg(buf: Buffer): { ancho: number; alto: number } {
  expect(buf[0]).toBe(0xff);
  expect(buf[1]).toBe(0xd8);
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error('JPG mal formado');
    const marca = buf[i + 1];
    const largo = buf.readUInt16BE(i + 2);
    if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {
      return { alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7) };
    }
    i += 2 + largo;
  }
  throw new Error('JPG sin tamaño');
}

describe('materiales.json', () => {
  it('es válido y tiene los tres grupos', () => {
    expect(typeof catalogo.nota).toBe('string');
    for (const lista of Object.values(grupos)) {
      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);
    }
  });

  it('cada material tiene los campos básicos bien formados', () => {
    for (const [grupo, lista] of Object.entries(grupos)) {
      for (const m of lista) {
        const donde = `${grupo}/${m.id}`;
        expect(m.id, donde).toMatch(/^[a-z0-9-]+$/);
        expect(m.nombre.trim().length, donde).toBeGreaterThan(0);
        expect(TIPOS, donde).toContain(m.tipo);
        expect(m.color, donde).toMatch(/^#[0-9a-f]{6}$/i);
        if (m.veta !== undefined) expect(m.veta, donde).toMatch(/^#[0-9a-f]{6}$/i);
        for (const c of m.motas ?? []) expect(c, donde).toMatch(/^#[0-9a-f]{6}$/i);
        expect(['catalogo-dto', 'generico'], donde).toContain(m.origen);
        if (m.rugosidad !== undefined) {
          expect(m.rugosidad, donde).toBeGreaterThanOrEqual(0);
          expect(m.rugosidad, donde).toBeLessThanOrEqual(1);
        }
        if (m.tamanoMm !== undefined) {
          // Escala real: una repetición de textura entre 5 cm y 3 m.
          expect(m.tamanoMm, donde).toBeGreaterThanOrEqual(50);
          expect(m.tamanoMm, donde).toBeLessThanOrEqual(3000);
        }
      }
    }
  });

  it('los ids son únicos dentro de cada grupo', () => {
    for (const [grupo, lista] of Object.entries(grupos)) {
      const ids = lista.map((m) => m.id);
      expect(new Set(ids).size, grupo).toBe(ids.length);
    }
  });

  it('cada textura existe en public/, es un JPG cuadrado y trae su tamaño real', () => {
    const conTextura = [...catalogo.melaminas, ...catalogo.cubiertas, ...catalogo.tiradores].filter((m) => m.textura);
    expect(conTextura.length).toBeGreaterThanOrEqual(MELAMINAS_COCINA.length + CUBIERTAS_OFICIALES.length);
    for (const m of conTextura) {
      expect(m.textura, m.id).toMatch(/^\/texturas\/[a-z0-9-]+\.jpg$/);
      const archivo = path.join('public', m.textura!);
      expect(fs.existsSync(archivo), `${m.id}: no existe ${archivo}`).toBe(true);
      const buf = fs.readFileSync(archivo);
      const { ancho, alto } = tamanoJpg(buf);
      expect(ancho, m.id).toBe(alto);
      expect(ancho, m.id).toBeGreaterThanOrEqual(512);
      expect(buf.length, `${m.id} pesa demasiado`).toBeLessThan(400 * 1024);
      expect(m.tamanoMm, `${m.id} sin tamanoMm`).toBeGreaterThan(0);
    }
  });

  it('están las 5 melaminas oficiales de cocina, primero y marcadas', () => {
    MELAMINAS_COCINA.forEach((id, i) => {
      const m = porId(catalogo.melaminas, id);
      expect(m.origen, id).toBe('catalogo-dto');
      expect(m.cocina, id).toBe(true);
      expect(m.textura, id).toBeTruthy();
      expect(catalogo.melaminas[i].id).toBe(id);
    });
    expect(porId(catalogo.melaminas, 'gris-blanqueado').tipo).toBe('madera');
    expect(porId(catalogo.melaminas, 'pino-casina').tipo).toBe('madera');
    expect(porId(catalogo.melaminas, 'pino-nebraska').tipo).toBe('madera');
    expect(porId(catalogo.melaminas, 'verde-salvia').tipo).toBe('liso');
    expect(porId(catalogo.melaminas, 'rojo').tipo).toBe('liso');
    // Solo esas son exclusivas de cocina.
    expect(catalogo.melaminas.filter((m) => m.cocina).map((m) => m.id).sort()).toEqual([...MELAMINAS_COCINA].sort());
  });

  it('están las 6 cubiertas postformadas oficiales, primero', () => {
    const oficiales = catalogo.cubiertas.filter((m) => m.origen === 'catalogo-dto').map((m) => m.id);
    expect([...oficiales].sort()).toEqual([...CUBIERTAS_OFICIALES].sort());
    expect(catalogo.cubiertas.slice(0, CUBIERTAS_OFICIALES.length).map((m) => m.id).sort()).toEqual([...CUBIERTAS_OFICIALES].sort());
    for (const id of CUBIERTAS_OFICIALES) expect(porId(catalogo.cubiertas, id).textura, id).toBeTruthy();
  });

  it('conserva los colores genéricos y los de uso por defecto', () => {
    for (const id of ['blanco', 'roble-natural', 'nogal', 'grafito', 'negro']) expect(porId(catalogo.melaminas, id).origen).toBe('generico');
    for (const id of ['granito-gris', 'carrara', 'blanco-liso', 'negro-mate']) expect(porId(catalogo.cubiertas, id).origen).toBe('generico');
    expect(porId(catalogo.tiradores, 'acero').metal).toBe(1);
  });
});
