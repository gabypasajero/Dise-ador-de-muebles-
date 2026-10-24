// Muebles de cocina del catálogo: conservan el precio de la tienda mientras no cambien sus medidas,
// menos las encimeras y lavaplatos que se quitan o van como solo corte.
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial } from '../shared/catalogo';
import { DESCUENTO_EQUIPO, ejecutar, fijarAncho, precioDiseno } from '../shared/reglas';
import type { Diseno, ProductoCatalogo } from '../shared/tipos';
import productos from '../public/datos/productos-respaldo.json';

const lista = ((productos as { productos?: unknown[] }).productos ?? productos) as Parameters<typeof clasificarProducto>[0][];
const xl = clasificarProducto(lista.find((x) => (x as { id: number }).id === 160)!) as ProductoCatalogo;
const base = disenoInicial(xl);
const tienda = xl.precio_oferta ?? xl.precio;
const precio = (d: Diseno) => precioDiseno(d, xl, base)!;

describe('precio de la tienda con descuentos por equipos', () => {
  it('tal cual vale el precio de la tienda', () => {
    expect(precio(base).total).toBe(tienda);
  });

  it('sin encimera ni lavaplatos se descuentan 30.000 cada uno (3 platos y simple)', () => {
    let d = base;
    for (const e of [...base.equipos]) d = ejecutar(d, { op: 'quitarEquipo', id: e.id }).diseno;
    expect(precio(d).total).toBe(tienda - DESCUENTO_EQUIPO.encimera['3'] - DESCUENTO_EQUIPO.lavaplatos.simple);
    expect(precio(d).lineas.map((l) => l.concepto)).toEqual(['Precio de la tienda', 'Sin encimera 3 platos', 'Sin lavaplatos simple']);
  });

  it('solo corte descuenta el equipo igual que quitarlo', () => {
    const lav = base.equipos.find((e) => e.tipo === 'lavaplatos')!;
    const d = ejecutar(base, { op: 'configurarEquipo', id: lav.id, cambios: { soloCorte: true } }).diseno;
    expect(precio(d).total).toBe(tienda - DESCUENTO_EQUIPO.lavaplatos.simple);
  });

  it('cambiar colores o módulos mantiene el precio de la tienda; cambiar medidas pasa al metro lineal', () => {
    const m = ejecutar(base, { op: 'agregarModulo', tramo: 'base', preset: 'puerta' }).diseno;
    expect(precio(m).total).toBe(tienda);
    expect(precio(fijarAncho(base, 2000)).lineas[0].concepto).not.toBe('Precio de la tienda');
  });

  it('cambiar el modelo de un equipo no cambia el precio; solo sacarlo lo descuenta', () => {
    const lav = base.equipos.find((e) => e.tipo === 'lavaplatos')!;
    const enc = base.equipos.find((e) => e.tipo === 'encimera')!;
    let d = ejecutar(base, { op: 'configurarEquipo', id: lav.id, cambios: { modelo: 'rinonera' } }).diseno;
    d = ejecutar(d, { op: 'configurarEquipo', id: enc.id, cambios: { platos: '4' } }).diseno;
    expect(precio(d).total).toBe(tienda);
    expect(precio(d).lineas).toHaveLength(1);
    // Sacar la riñonera descuenta el lavaplatos que traía el producto (simple).
    d = ejecutar(d, { op: 'quitarEquipo', id: lav.id }).diseno;
    expect(precio(d).total).toBe(tienda - DESCUENTO_EQUIPO.lavaplatos.simple);
  });

  it('los valores de descuento son los de la tienda', () => {
    expect(DESCUENTO_EQUIPO).toEqual({ encimera: { '3': 30000, '4': 60000 }, lavaplatos: { simple: 30000, doble: 35000, rinonera: 30000 } });
  });
});
