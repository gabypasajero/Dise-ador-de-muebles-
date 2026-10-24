// Medidas reales del equipamiento (ancho total vs. corte), lavaplatos riñonera y precio de la
// tienda para todos los muebles del catálogo (no solo la cocina).
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial, disenoLibre } from '../shared/catalogo';
import { cabeEncimera, choqueEnModulo, distanciasEquipos, margenMaximo, opcionesEquipo } from '../shared/equipos';
import { MEDIDAS_EQUIPO, anchoTotalEquipo, ubicarEquipos } from '../shared/layout';
import { revisarOperacion } from '../shared/operaciones';
import { DESCUENTO_EQUIPO, agregarEquipo, configurarEquipo, ejecutar, fijarAncho, normalizar, precioDiseno, precioReferencial } from '../shared/reglas';
import { detalleCotizacion } from '../shared/resumen';
import { precioCocina, TARIFAS } from '../shared/tarifas';
import type { Diseno, Lavaplatos, ProductoCatalogo } from '../shared/tipos';
import productos from '../public/datos/productos-respaldo.json';

const lista = ((productos as { productos?: unknown[] }).productos ?? productos) as Parameters<typeof clasificarProducto>[0][];
const prod = (id: number) => clasificarProducto(lista.find((x) => (x as { id: number }).id === id)!) as ProductoCatalogo;
const lavaplatos = (d: Diseno) => d.equipos.find((e): e is Lavaplatos => e.tipo === 'lavaplatos')!;

describe('medidas reales del equipamiento', () => {
  it('ancho total separado del corte', () => {
    expect(MEDIDAS_EQUIPO.lavaplatos.simple).toMatchObject({ ancho: 400, anchoTotal: 800 });
    expect(MEDIDAS_EQUIPO.lavaplatos.doble).toMatchObject({ ancho: 770, anchoTotal: 770 });
    expect(MEDIDAS_EQUIPO.lavaplatos.rinonera).toMatchObject({ ancho: 550, fondo: 400, anchoTotal: 610 });
    expect(MEDIDAS_EQUIPO.encimera['3']).toMatchObject({ ancho: 580, anchoTotal: 730 });
    expect(MEDIDAS_EQUIPO.encimera['4']).toMatchObject({ ancho: 580, anchoTotal: 600 });
  });

  it('las distancias se miden entre los equipos completos y suman el largo de la cubierta', () => {
    let d = fijarAncho(disenoLibre('cocina'), 2400);
    d = configurarEquipo(d, d.equipos.find((e) => e.tipo === 'encimera')!.id, { platos: '3' });
    const ub = ubicarEquipos(d).filter((u) => u.tipo === 'encimera' || u.tipo === 'lavaplatos').sort((a, b) => a.s - b.s);
    expect(ub.map((u) => u.total!.s1 - u.total!.s0).sort()).toEqual([730, 800]);
    const ds = distanciasEquipos(d).filter((x) => x.tramo === 'base');
    expect(ds[1].mm).toBe(Math.round(ub[1].total!.s0 - ub[0].total!.s1));
    const suma = ds.reduce((s, x) => s + x.mm, 0) + 730 + 800;
    expect(Math.abs(suma - 2400)).toBeLessThanOrEqual(2);
  });

  it('el lavaplatos simple queda al menos a 5 cm del borde y su margen máximo usa los 80 cm', () => {
    const d = fijarAncho(disenoLibre('cocina'), 2400);
    const l = lavaplatos(d);
    const c = d.cuerpos.find((x) => x.id === l.modulo)!;
    expect(margenMaximo({ ...c, ancho: 1000 }, l)).toBe(1000 - 800 - 15);
    expect(margenMaximo({ ...c, ancho: 600 }, l)).toBe(50);
    expect(margenMaximo({ ...c, ancho: 1000 }, { ...l, modelo: 'rinonera' })).toBe(1000 - 610 - 15);
    expect(anchoTotalEquipo(disenoLibre('cocina-infantil'), l)).toBe(400);
  });

  it('el secador del simple va hacia adentro del módulo', () => {
    let d = fijarAncho(disenoLibre('cocina'), 2400);
    d = configurarEquipo(d, lavaplatos(d).id, { posicion: 'izq' });
    expect(ubicarEquipos(d).find((u) => u.tipo === 'lavaplatos')!.secador).toBe('der');
    d = configurarEquipo(d, lavaplatos(d).id, { posicion: 'der' });
    expect(ubicarEquipos(d).find((u) => u.tipo === 'lavaplatos')!.secador).toBe('izq');
  });

  it('la encimera de 3 platos (73 cm) necesita más espacio en la punta que la de 4', () => {
    const d = disenoLibre('cocina');
    const i = d.cuerpos.findIndex((c) => c.id === d.equipos.find((e) => e.tipo === 'encimera')!.modulo);
    expect(cabeEncimera(d, 'base', i, '4')).toBe(true);
    const angosto = { ...d, cuerpos: d.cuerpos.map((c, k) => (k === i ? { ...c, ancho: 340 } : c)) };
    expect(cabeEncimera(angosto, 'base', i, '4')).toBe(true);
    expect(cabeEncimera(angosto, 'base', i, '3')).toBe(false);
  });

  it('encimera y lavaplatos se topan por sus anchos totales', () => {
    let d = fijarAncho(disenoLibre('cocina'), 3000);
    const l = lavaplatos(d);
    d = { ...d, equipos: d.equipos.map((e) => (e.tipo === 'encimera' ? { ...e, modulo: l.modulo } : e)) };
    expect(choqueEnModulo(d, l)).toMatch(/no caben juntos/);
  });
});

describe('lavaplatos riñonera', () => {
  it('se ofrece en la cocina adulta y el asistente lo acepta', () => {
    expect(opcionesEquipo('cocina').lavaplatos).toEqual(['simple', 'doble', 'rinonera']);
    expect(opcionesEquipo('cocina-infantil').lavaplatos).toEqual(['simple']);
    expect(revisarOperacion({ op: 'configurarEquipo', id: 'x', cambios: { modelo: 'rinonera' } })).toBeNull();
  });

  it('se configura, se ubica con 61 cm y aparece en los textos', () => {
    let d = fijarAncho(disenoLibre('cocina'), 2400);
    const r = ejecutar(d, { op: 'configurarEquipo', id: lavaplatos(d).id, cambios: { modelo: 'rinonera' } });
    expect(r.ok).toBe(true);
    d = r.diseno;
    const u = ubicarEquipos(d).find((x) => x.tipo === 'lavaplatos')!;
    expect(u.total!.s1 - u.total!.s0).toBe(610);
    expect(u.ancho).toBe(550);
    expect(u.secador).toBeUndefined();
    const eq = detalleCotizacion(d, null, 'cm', null).find((l) => l.etiqueta === 'Equipamiento')!.valor;
    expect(eq).toContain('lavaplatos riñonera');
  });

  it('normalizar respeta la riñonera y deja simple un modelo desconocido', () => {
    const d = disenoLibre('cocina');
    const con = (modelo: string) => ({ ...d, equipos: d.equipos.map((e) => (e.tipo === 'lavaplatos' ? { ...e, modelo } : e)) }) as unknown as Diseno;
    expect(lavaplatos(normalizar(con('rinonera'))).modelo).toBe('rinonera');
    expect(lavaplatos(normalizar(con('triple'))).modelo).toBe('simple');
  });

  it('tarifa y descuento en una sola constante', () => {
    expect(TARIFAS.lavaplatos.rinonera).toBe(40000);
    expect(DESCUENTO_EQUIPO.lavaplatos.rinonera).toBe(30000);
    const d = agregarEquipo({ ...disenoLibre('cocina'), equipos: [] }, 'lavaplatos', { modelo: 'rinonera' });
    expect(precioCocina(d).lineas.find((l) => l.concepto === 'Lavaplatos riñonera')!.valor).toBe(40000);
  });

  it('en una cocina del catálogo: cambiar el simple por riñonera mantiene el precio de la tienda', () => {
    const p = prod(160);
    const base = disenoInicial(p);
    const tienda = p.precio_oferta ?? p.precio;
    const d = ejecutar(base, { op: 'configurarEquipo', id: lavaplatos(base).id, cambios: { modelo: 'rinonera' } }).diseno;
    const precio = precioDiseno(d, p, base)!;
    expect(precio.total).toBe(tienda);
    expect(precio.lineas.map((l) => l.concepto)).toEqual(['Precio de la tienda']);
  });
});

describe('precio de la tienda en todos los muebles del catálogo', () => {
  for (const [id, nombre] of [
    [156, 'closet'],
    [153, 'compacto'],
    [167, 'cómoda'],
  ] as const) {
    it(`${nombre}: mismas medidas → precio de la tienda; módulos o colores no lo cambian; otras medidas → referencial`, () => {
      const p = prod(id);
      const base = disenoInicial(p);
      const tienda = p.precio_oferta ?? p.precio;
      expect(precioDiseno(base, p, base)).toMatchObject({ metodo: 'oficial', total: tienda });
      const otroColor = { ...base, materiales: { ...base.materiales } } as Diseno;
      expect(precioDiseno(otroColor, p, base)!.total).toBe(tienda);
      const m = ejecutar(base, { op: 'agregarModulo', tramo: 'base', preset: 'puerta' });
      if (m.ok && m.diseno.ancho === base.ancho) expect(precioDiseno(m.diseno, p, base)!.total).toBe(tienda);
      const ancho = ejecutar(base, { op: 'fijarAncho', ancho: base.ancho + 200 }).diseno;
      expect(ancho.ancho).not.toBe(base.ancho);
      const ref = precioDiseno(ancho, p, base)!;
      expect(ref.metodo).toBe('referencial');
      expect(ref.total).toBe(precioReferencial(ancho, p, base));
    });
  }

  it('el compacto sin su lavaplatos descuenta el equipo', () => {
    const p = prod(153);
    const base = disenoInicial(p);
    const l = base.equipos.find((e) => e.tipo === 'lavaplatos');
    if (!l) return;
    const d = ejecutar(base, { op: 'quitarEquipo', id: l.id }).diseno;
    expect(precioDiseno(d, p, base)!.total).toBe((p.precio_oferta ?? p.precio) - DESCUENTO_EQUIPO.lavaplatos.simple);
  });
});
