// Muebles de cocina del catálogo: conservan el precio de la tienda mientras no cambien sus medidas,
// menos las encimeras y lavaplatos que se quitan o van como solo corte.
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial } from '../shared/catalogo';
import { activarAereos, actualizarCuerpo, agregarEquipo, agregarModulo, DESCUENTO_EQUIPO, ejecutar, fijarAereos, fijarAncho, precioDiseno, presetsModulo } from '../shared/reglas';
import { largoAereo, precioAereo, TARIFAS } from '../shared/tarifas';
import { moduloCampana } from '../shared/equipos';
import { describirTramo } from '../shared/resumen';
import { validarDiseno } from '../shared/validar';
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
    expect(DESCUENTO_EQUIPO).toEqual({ encimera: { '3': 30000, '4': 60000 }, lavaplatos: { simple: 20000, doble: 20000, rinonera: 20000 }, horno: 120000 });
  });

  it('cierre suave, sin manilla y especiero agregado se suman al precio de la tienda', () => {
    expect(tienda).toBe((xl as { precio_oferta?: number | null; precio: number }).precio_oferta ?? xl.precio);
    let d = ejecutar(base, { op: 'fijarAcabados', cierreSuave: true, tirador: 'sin' }).diseno;
    expect(precio(d).total).toBe(tienda + 30000 + 20000);
    expect(precio(d).lineas.map((l) => l.concepto)).toEqual(['Precio de la tienda', 'Cierre suave en puertas y cajones', 'Sistema sin manilla']);
    const antes = base.cuerpos.filter((c) => c.tipo === 'especiero').length;
    d = ejecutar(d, { op: 'agregarModulo', tramo: 'base', preset: 'especiero' }).diseno;
    expect(d.cuerpos.filter((c) => c.tipo === 'especiero').length).toBe(antes + 1);
    expect(precio(d).lineas[0].concepto).toBe('Precio de la tienda');
    expect(precio(d).total).toBe(tienda + 30000 + 20000 + 20000);
    expect(precio(d).lineas.some((l) => l.concepto === 'Especiero agregado')).toBe(true);
  });
});

describe('horno en una cocina del catálogo que lo trae', () => {
  const p = clasificarProducto(lista.find((x) => (x as { id: number }).id === 16)!) as ProductoCatalogo;
  const b = disenoInicial(p);
  const t = p.precio_oferta ?? p.precio;
  it('retirarlo descuenta $120.000; agregar otro suma su tarifa', () => {
    const i = b.cuerpos.findIndex((c) => c.tipo === 'horno');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(precioDiseno(b, p, b)!.total).toBe(t);
    const sin = actualizarCuerpo(b, i, { tipo: 'frentes' });
    expect(sin.cuerpos.some((c) => c.tipo === 'horno')).toBe(false);
    expect(precioDiseno(sin, p, b)!.total).toBe(t - 120000);
    expect(precioDiseno(sin, p, b)!.lineas.map((l) => l.concepto)).toContain('Sin horno eléctrico');
    const otro = agregarEquipo(b, 'horno');
    expect(precioDiseno(agregarEquipo(b, 'horno'), p, b)!.total).toBe(t + 170000);
    void otro;
  });
});

describe('precio de la tienda con aéreo y campana (producto 160 sin aéreos)', () => {
  it('el producto base no trae aéreos', () => {
    expect(base.aereos.activo && base.aereos.cuerpos.length > 0).toBe(false);
  });

  it('activar aéreos suma el aéreo por metro; alto, campana y apagarlos', () => {
    const con = activarAereos(base, true);
    const aereo = precioAereo(con)!;
    expect(aereo.valor).toBe(Math.round((largoAereo(con) * 130000) / 1000));
    const p = precio(con);
    expect(p.total).toBe(tienda + aereo.valor);
    expect(p.lineas[0].concepto).toBe('Precio de la tienda');
    expect(p.lineas.find((l) => l.concepto === 'Mueble aéreo')!.detalle).toBe(aereo.lineas[0].detalle);
    // 5 cm más de alto: +10.000.
    const alto = fijarAereos(con, { alto: con.aereos.alto + 50 });
    expect(precio(alto).total).toBe(tienda + aereo.valor + 10000);
    expect(precio(alto).lineas.map((l) => l.concepto)).toContain('Aéreo: alto adicional');
    // Campana agregada: +70.000.
    const campana = agregarEquipo(alto, 'campana');
    expect(precio(campana).total).toBe(tienda + aereo.valor + 10000 + TARIFAS.campana);
    expect(precio(campana).lineas.map((l) => l.concepto)).toContain('Campana agregada');
    // Apagar los aéreos: vuelve al precio de la tienda (más la campana, que queda mural).
    expect(precio(activarAereos(alto, false)).total).toBe(tienda);
  });

  it('si el producto ya traía aéreo, solo suma la diferencia positiva y apagarlo lo descuenta', () => {
    const conBase = activarAereos(base, true);
    const p = (d: Diseno) => precioDiseno(d, xl, conBase)!;
    const incluido = precioAereo(conBase)!.valor;
    expect(p(conBase).total).toBe(tienda);
    expect(p(fijarAereos(conBase, { alto: conBase.aereos.alto + 50 })).total).toBe(tienda + 10000);
    expect(p(fijarAereos(conBase, { alto: 400 })).total).toBe(tienda);
    expect(p(activarAereos(conBase, false)).total).toBe(tienda - incluido);
  });
});

describe('espacio campana en los aéreos', () => {
  const preset = presetsModulo('cocina', 'aereos').find((x) => x.id === 'espacio-campana')!;

  it('existe en cocina y compacto, mide 60 cm, sin puertas ni repisas y no se cobra', () => {
    expect(preset).toMatchObject({ texto: 'Espacio campana', ayuda: 'Hueco abierto de 60 cm para instalar la campana', ancho: 600 });
    expect(presetsModulo('compacto', 'aereos').some((x) => x.id === 'espacio-campana')).toBe(true);
    const con = activarAereos(base, true);
    const d = agregarModulo(con, preset, 0, 'aereos');
    const c = d.aereos.cuerpos.find((x) => x.tipo === 'espacio-campana')!;
    expect(c).toMatchObject({ ancho: 600, puertas: 0, repisas: 0 });
    expect(precio(d).total).toBe(precio(con).total);
    expect(describirTramo(d, 'aereos', 'cm').join(' ')).toMatch(/espacio para campana 60 cm \(sin puertas\)/);
    expect(validarDiseno(d)).toEqual([]);
  });

  it('una campana agregada se aloja en el espacio campana en vez de crear otro módulo', () => {
    const d0 = agregarModulo(activarAereos(base, true), preset, 0, 'aereos');
    const n = d0.aereos.cuerpos.length;
    const d = agregarEquipo(d0, 'campana');
    const enc = d.equipos.find((e) => e.tipo === 'encimera')!;
    const m = moduloCampana(d, enc.id)!;
    expect(m).not.toBeNull();
    expect(d.aereos.cuerpos[m.indice].tipo).toBe('espacio-campana');
    expect(d.aereos.cuerpos.filter((c) => c.tipo === 'campana')).toHaveLength(0);
    expect(d.aereos.cuerpos.length).toBe(n);
    expect(validarDiseno(d)).toEqual([]);
    // Al quitar la campana el espacio queda libre (no pasa a ser de puertas).
    const sin = ejecutar(d, { op: 'quitarEquipo', id: `${enc.id}:campana` }).diseno;
    expect(sin.aereos.cuerpos.some((c) => c.tipo === 'espacio-campana' && !c.campanaDe)).toBe(true);
    expect(validarDiseno(sin)).toEqual([]);
  });
});
