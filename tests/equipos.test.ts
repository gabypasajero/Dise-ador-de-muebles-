// Equipamiento de cocina: agregar, quitar y mover encimera, horno, lavaplatos (con o sin
// llave) y campana en cualquier tramo; lavaplatos al borde; campana siempre sobre la encimera.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial, disenoLibre } from '../shared/catalogo';
import { ubicarEquipos } from '../shared/layout';
import {
  activarAereos,
  actualizarCuerpo,
  agregarEquipo,
  agregarModulo,
  configurarEquipo,
  cuerposDe,
  ejecutar,
  equipoLegado,
  fijarAereos,
  fijarAncho,
  fijarCocinaLegado,
  fijarForma,
  fijarLado,
  listarEquipamiento,
  moverCuerpo,
  moverEquipo,
  nombreModulo,
  opcionesEquipo,
  presetsModulo,
  quitarCuerpo,
  quitarEquipo,
} from '../shared/reglas';
import { validarDiseno } from '../shared/validar';
import { conCajoneras } from './cocinas';
import type { Diseno, Encimera, Lavaplatos, ProductoTienda, Tramo } from '../shared/tipos';

const productos = JSON.parse(fs.readFileSync('public/datos/productos-respaldo.json', 'utf8')) as ProductoTienda[];
const prod = (id: number) => clasificarProducto(productos.find((x) => x.id === id)!);
const full = () => disenoInicial(prod(16));
const encimera = (d: Diseno) => d.equipos.find((e): e is Encimera => e.tipo === 'encimera')!;
const lavaplatos = (d: Diseno) => d.equipos.find((e): e is Lavaplatos => e.tipo === 'lavaplatos')!;
const preset = (id: string, t: Tramo = 'base') => presetsModulo('cocina', t).find((p) => p.id === id)!;

/** La campana está en un módulo de campana de los aéreos que contiene el centro de su encimera. */
function campanaAlineada(d: Diseno): boolean {
  const u = ubicarEquipos(d);
  return u
    .filter((x) => x.tipo === 'campana')
    .every((c) => {
      const e = u.find((x) => x.id === c.encimera)!;
      if (c.montaje === 'mural') return Math.abs(c.mundo.x - e.mundo.x) < 1 && Math.abs(c.mundo.z - e.mundo.z) < 1;
      const m = cuerposDe(d, c.tramo)[c.indice];
      return m.tipo === 'campana' && Math.abs(c.mundo.x - e.mundo.x) < 1 && Math.abs(c.mundo.z - e.mundo.z) < 1;
    });
}

describe('agregar y quitar equipamiento', () => {
  it('encimera, horno, lavaplatos, llave y campana se agregan y se quitan', () => {
    let d = fijarAncho(full(), 3000);
    const lista = () => listarEquipamiento(d).map((x) => x.tipo);
    expect(lista()).toEqual(['horno', 'encimera', 'lavaplatos', 'llave']);
    d = agregarEquipo(d, 'campana');
    expect(lista()).toEqual(['horno', 'encimera', 'campana', 'lavaplatos', 'llave']);
    const campana = listarEquipamiento(d).find((x) => x.tipo === 'campana')!;
    expect(campana.detalle).toMatch(/mural/);
    d = quitarEquipo(d, campana.id);
    d = quitarEquipo(d, `${lavaplatos(d).id}:llave`);
    expect(lavaplatos(d).llave).toBe(false);
    d = agregarEquipo(d, 'llave');
    expect(lavaplatos(d).llave).toBe(true);
    // Quitar el horno deja el módulo como uno de puertas del mismo ancho.
    const horno = d.cuerpos[0];
    const r = ejecutar(d, { op: 'quitarEquipo', id: horno.id });
    expect(r.diseno.cuerpos[0]).toMatchObject({ id: horno.id, tipo: 'frentes', ancho: 600, puertas: 2 });
    expect(encimera(r.diseno).modulo).toBe(horno.id);
    d = agregarEquipo(r.diseno, 'horno', { modulo: 0 });
    expect(d.cuerpos[0].tipo).toBe('horno');
    d = quitarEquipo(d, encimera(d).id);
    expect(d.equipos.some((e) => e.tipo === 'encimera')).toBe(false);
    expect(ejecutar(d, { op: 'agregarEquipo', equipo: 'campana' }).motivo).toMatch(/agrega primero una encimera/);
    d = agregarEquipo(d, 'encimera');
    // Sin módulo indicado la encimera va sobre el horno.
    expect(encimera(d)).toMatchObject({ modulo: d.cuerpos[0].id, platos: '4' });
    expect(validarDiseno(d)).toEqual([]);
  });

  it('la cocina adulta ofrece encimera de 3 y 4 platos; la infantil también de 2', () => {
    expect(opcionesEquipo('cocina').platos).toEqual(['3', '4']);
    expect(opcionesEquipo('compacto').platos).toEqual(['3', '4']);
    expect(opcionesEquipo('cocina-infantil')).toMatchObject({ platos: ['2', '3', '4'], campana: false, llave: false });
    const d = full();
    const r = ejecutar(d, { op: 'configurarEquipo', id: encimera(d).id, cambios: { platos: '2' } });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/3 o 4 platos/);
  });

  it('el equipamiento solo va sobre módulos que lo pueden llevar', () => {
    // [horno][cajonera 90][puerta 70 + lavaplatos][espacio libre 50]: el especiero lo absorbe la cajonera.
    let d = agregarModulo(fijarAncho(full(), 2200), preset('hueco'), 3, 'base', true);
    d = agregarModulo(d, preset('especiero'), 1);
    expect(d.cuerpos.map((c) => c.tipo)).toEqual(['horno', 'especiero', 'frentes', 'frentes', 'hueco']);
    const iHueco = d.cuerpos.findIndex((c) => c.tipo === 'hueco');
    const iEsp = d.cuerpos.findIndex((c) => c.tipo === 'especiero');
    const motivo = (op: Parameters<typeof ejecutar>[1]) => ejecutar(d, op).motivo;
    expect(motivo({ op: 'moverEquipo', id: lavaplatos(d).id, tramo: 'base', modulo: 0 })).toMatch(/el horno/);
    expect(motivo({ op: 'moverEquipo', id: encimera(d).id, tramo: 'base', modulo: iHueco })).toMatch(/espacio libre/);
    expect(motivo({ op: 'moverEquipo', id: encimera(d).id, tramo: 'base', modulo: iEsp })).toMatch(/especiero/);
    expect(motivo({ op: 'agregarEquipo', equipo: 'lavaplatos', modulo: d.cuerpos.findIndex((c) => c.id === lavaplatos(d).modulo) })).toMatch(/ya tiene un lavaplatos/);
    // Cambiar el tipo del módulo del lavaplatos lo lleva al módulo válido más cercano.
    const iLav = d.cuerpos.findIndex((c) => c.id === lavaplatos(d).modulo);
    const r = ejecutar(d, { op: 'actualizarModulo', tramo: 'base', modulo: iLav, cambios: { tipo: 'hueco' } });
    expect(r.ok).toBe(true);
    expect(r.diseno.cuerpos.find((c) => c.id === lavaplatos(r.diseno).modulo)!.tipo).toBe('frentes');
    expect(r.avisos.join(' ')).toMatch(/El lavaplatos simple pasó al módulo/);
  });

  it('en el compacto también se agregan horno, encimera, lavaplatos y campana', () => {
    let d = fijarAncho(disenoInicial(prod(154)), 2400);
    d = agregarEquipo(d, 'horno');
    expect(d.cuerpos.some((c) => c.tipo === 'horno' && c.ancho === 600)).toBe(true);
    d = agregarEquipo(d, 'encimera', { platos: '3' });
    d = agregarEquipo(d, 'lavaplatos');
    d = agregarEquipo(d, 'campana');
    expect(d.aereos.cuerpos.some((c) => c.tipo === 'campana' && c.campanaDe === encimera(d).id)).toBe(true);
    expect(campanaAlineada(d)).toBe(true);
    expect(validarDiseno(d)).toEqual([]);
  });
});

describe('equipamiento en los lados de la L y la U', () => {
  it('se mueve de forma independiente a cualquier módulo de cualquier lado', () => {
    let d = fijarLado(fijarLado(fijarForma(fijarAncho(full(), 2400), 'U'), 'izq', { largo: 1800 }), 'der', { largo: 1800 });
    // El lado izquierdo queda con tres módulos: [2 puertas][puerta][puerta] (agrandando el lado).
    d = agregarModulo(d, preset('puerta', 'izq'), undefined, 'izq', true);
    d = agregarModulo(d, preset('puerta', 'izq'), undefined, 'izq', true);
    expect(d.lados.izq!.cuerpos).toHaveLength(3);
    d = moverEquipo(d, encimera(d).id, 'der', 0);
    expect(encimera(d)).toMatchObject({ tramo: 'der', modulo: d.lados.der!.cuerpos[0].id });
    d = moverEquipo(d, lavaplatos(d).id, 'izq', 2);
    expect(lavaplatos(d)).toMatchObject({ tramo: 'izq', modulo: d.lados.izq!.cuerpos[2].id });
    // El horno se mueve intercambiando su contenido con el del módulo de destino.
    const destino = d.lados.izq!.cuerpos[0];
    const r = ejecutar(d, { op: 'moverEquipo', id: d.cuerpos[0].id, tramo: 'izq', modulo: 0 });
    expect(r.ok).toBe(true);
    const m = r.diseno;
    expect(m.lados.izq!.cuerpos[0]).toMatchObject({ id: destino.id, tipo: 'horno', ancho: 600 });
    expect(m.cuerpos[0]).toMatchObject({ tipo: destino.tipo, puertas: destino.puertas });
    expect(m.ancho).toBe(d.ancho);
    expect(m.lados.izq!.largo).toBe(d.lados.izq!.largo);
    expect(validarDiseno(m)).toEqual([]);
    // Los equipos de otros módulos no se movieron.
    expect(encimera(m).tramo).toBe('der');
    expect(lavaplatos(m).tramo).toBe('izq');
  });

  it('el detalle por lado nombra el módulo y el lado de cada equipo', () => {
    let d = fijarForma(fijarAncho(full(), 2400), 'L-der');
    d = moverEquipo(d, lavaplatos(d).id, 'der', 0);
    const it = listarEquipamiento(d).find((x) => x.tipo === 'lavaplatos')!;
    expect(it.donde).toBe('módulo 1 del lado derecho');
  });
});

describe('lavaplatos centrado o pegado a un borde', () => {
  it('por defecto va centrado; al borde queda al menos a 5 cm y el cliente puede darle más', () => {
    let d = fijarAncho(full(), 2400);
    const l0 = lavaplatos(d);
    expect(l0).toMatchObject({ posicion: 'centro', margen: 50 });
    const modulo = () => {
      const i = d.cuerpos.findIndex((c) => c.id === lavaplatos(d).modulo);
      const s0 = d.cuerpos.slice(0, i).reduce((s, c) => s + c.ancho, 0);
      return { s0, s1: s0 + d.cuerpos[i].ancho };
    };
    const centro = () => ubicarEquipos(d).find((u) => u.tipo === 'lavaplatos')!.s;
    expect(centro()).toBe((modulo().s0 + modulo().s1) / 2);
    d = configurarEquipo(d, l0.id, { posicion: 'izq' });
    expect(centro() - 200).toBe(modulo().s0 + 50);
    d = configurarEquipo(d, l0.id, { posicion: 'der', margen: 120 });
    expect(centro() + 200).toBe(modulo().s1 - 120);
    const r = ejecutar(d, { op: 'configurarEquipo', id: l0.id, cambios: { margen: 20 } });
    expect(lavaplatos(r.diseno).margen).toBe(50);
    expect(r.avisos.join(' ')).toMatch(/al menos a 5 cm/);
    // No puede salirse de su módulo.
    const lejos = ejecutar(d, { op: 'configurarEquipo', id: l0.id, cambios: { margen: 2000 } });
    const ancho = lejos.diseno.cuerpos.find((c) => c.id === l0.modulo)!.ancho;
    expect(lavaplatos(lejos.diseno).margen).toBe(ancho - 400 - 15);
    expect(validarDiseno(lejos.diseno)).toEqual([]);
  });
});

describe('la campana queda siempre sobre la encimera', () => {
  const conCampana = () => agregarEquipo(activarAereos(fijarAncho(full(), 2400), true), 'campana');
  /**
   * En la cocina solo ceden las cajoneras y los abatibles: con cajoneras de 90 cm en el base y
   * dos abatibles de 90 cm en los aéreos (además de la campana) hay de dónde agregar y quitar.
   */
  const conCampanaAjustable = () => {
    let d = agregarEquipo(activarAereos(conCajoneras(fijarAncho(full(), 2400), [900, 900]), true), 'campana');
    for (const i of [1, 2]) d = actualizarCuerpo(d, i, { puertas: 1, abatible: true }, 'aereos');
    d = quitarCuerpo(d, 3, 'aereos');
    expect(d.aereos.cuerpos.filter((c) => c.abatible && c.tipo === 'frentes').map((c) => c.ancho)).toEqual([900, 900]);
    return d;
  };

  it('se ubica sola sobre la encimera al agregarla', () => {
    const r = ejecutar(activarAereos(fijarAncho(full(), 2400), true), { op: 'agregarEquipo', equipo: 'campana' });
    expect(r.avisos.join(' ')).toMatch(/Se agregó el módulo de campana en los aéreos/);
    expect(campanaAlineada(r.diseno)).toBe(true);
    // También pasando a campana un aéreo cualquiera.
    const d = activarAereos(fijarAncho(full(), 2400), true);
    const m = ejecutar(d, { op: 'actualizarModulo', tramo: 'aereos', modulo: d.aereos.cuerpos.length - 1, cambios: { tipo: 'campana' } });
    expect(encimera(m.diseno).campana).toBe(true);
    expect(campanaAlineada(m.diseno)).toBe(true);
    expect(validarDiseno(m.diseno)).toEqual([]);
  });

  it('se agreguen, quiten o muevan los módulos que sea', () => {
    let d = conCampanaAjustable();
    const pasos: ((x: Diseno) => Diseno)[] = [
      (x) => agregarModulo(x, preset('puerta'), 0),
      (x) => agregarModulo(x, preset('especiero'), 0),
      (x) => moverCuerpo(x, 2, -1),
      (x) => moverCuerpo(x, 0, 1),
      (x) => quitarCuerpo(x, 1),
      (x) => agregarModulo(x, preset('aereo-puerta', 'aereos'), 0, 'aereos'),
      (x) => moverCuerpo(x, x.aereos.cuerpos.findIndex((c) => c.tipo !== 'campana'), 1, 'aereos'),
      (x) => quitarCuerpo(x, x.aereos.cuerpos.findIndex((c) => c.ancho === 350), 'aereos'),
      (x) => fijarAncho(x, 3000),
      (x) => fijarAereos(x, { profundidad: 350 }),
      // El último módulo tiene el lavaplatos (no caben juntos): la encimera va al penúltimo.
      (x) => moverEquipo(x, encimera(x).id, 'base', x.cuerpos.length - 2),
    ];
    for (const paso of pasos) {
      const antes = d;
      d = paso(d);
      expect(d).not.toBe(antes);
      expect(campanaAlineada(d)).toBe(true);
      expect(validarDiseno(d)).toEqual([]);
    }
  });

  it('mover la campana se rechaza y mover un aéreo la salta', () => {
    const d = conCampana();
    const i = d.aereos.cuerpos.findIndex((c) => c.tipo === 'campana');
    expect(ejecutar(d, { op: 'moverModulo', tramo: 'aereos', modulo: i, delta: 1 }).motivo).toMatch(/sobre su encimera/);
    expect(ejecutar(d, { op: 'moverEquipo', id: `${encimera(d).id}:campana`, tramo: 'base', modulo: 1 }).motivo).toMatch(/mueve la encimera/);
    const otro = i > 0 ? i - 1 : i + 1;
    const m = moverCuerpo(d, otro, otro < i ? 1 : -1, 'aereos');
    expect(m.aereos.cuerpos.findIndex((c) => c.tipo === 'campana')).toBe(i);
    expect(campanaAlineada(m)).toBe(true);
  });

  it('aunque la encimera pase a un lado de la L o la U, o cambie la forma', () => {
    let d = conCampana();
    d = fijarLado(fijarForma(d, 'U'), 'der', { largo: 1800 });
    expect(campanaAlineada(d)).toBe(true);
    const r = ejecutar(d, { op: 'moverEquipo', id: encimera(d).id, tramo: 'der', modulo: 0 });
    expect(r.ok).toBe(true);
    d = r.diseno;
    expect(d.aereos.lados.der!.cuerpos.some((c) => c.tipo === 'campana' && c.campanaDe === encimera(d).id)).toBe(true);
    expect(d.aereos.cuerpos.some((c) => c.tipo === 'campana')).toBe(false);
    expect(campanaAlineada(d)).toBe(true);
    expect(validarDiseno(d)).toEqual([]);
    // Al quitar ese lado la encimera vuelve al principal y la campana con ella.
    d = fijarForma(d, 'L-izq');
    expect(encimera(d).tramo).toBe('base');
    expect(campanaAlineada(d)).toBe(true);
    expect(validarDiseno(d)).toEqual([]);
    // Sin aéreos la campana es mural, sobre la encimera.
    d = activarAereos(d, false);
    expect(ubicarEquipos(d).find((u) => u.tipo === 'campana')!.montaje).toBe('mural');
    expect(campanaAlineada(d)).toBe(true);
  });

  it('quitar el módulo de la campana quita la campana; quitar la encimera también', () => {
    // Tres abatibles de 60 cm toman los 60 cm de la campana al quitarla.
    const d = agregarModulo(conCampanaAjustable(), preset('abatible', 'aereos'), undefined, 'aereos');
    expect(d.aereos.cuerpos.filter((c) => c.abatible && c.tipo === 'frentes').map((c) => c.ancho)).toEqual([600, 600, 600]);
    const i = d.aereos.cuerpos.findIndex((c) => c.tipo === 'campana');
    const q = ejecutar(d, { op: 'quitarModulo', tramo: 'aereos', modulo: i });
    expect(q.ok).toBe(true);
    expect(q.diseno.aereos.cuerpos.filter((c) => c.abatible && c.tipo === 'frentes').map((c) => c.ancho)).toEqual([800, 800, 800]);
    expect(encimera(q.diseno).campana).toBe(false);
    expect(q.avisos.join(' ')).toMatch(/Se quitó la campana/);
    const sin = ejecutar(d, { op: 'quitarEquipo', id: encimera(d).id });
    expect(sin.diseno.aereos.cuerpos.some((c) => c.tipo === 'campana')).toBe(false);
    expect(sin.avisos.join(' ')).toMatch(/También se quitó su campana/);
    expect(validarDiseno(sin.diseno)).toEqual([]);
  });
});

describe('compatibilidad con la pestaña de equipamiento anterior', () => {
  it('equipoLegado y fijarCocinaLegado traducen al modelo por módulo', () => {
    let d = full();
    expect(equipoLegado(d)).toEqual({ encimera: '4', encimeraCuerpo: 0, lavaplatos: 'simple', lavaplatosCuerpo: 2 });
    d = fijarCocinaLegado(d, { lavaplatosCuerpo: 1, grifo: 'cromado' });
    expect(equipoLegado(d).lavaplatosCuerpo).toBe(1);
    expect(d.cocina.grifo).toBe('cromado');
    d = fijarCocinaLegado(d, { encimera: '2' });
    expect(equipoLegado(d).encimera).toBe('3');
    d = fijarCocinaLegado(d, { lavaplatos: 'ninguno' });
    expect(d.equipos.some((e) => e.tipo === 'lavaplatos')).toBe(false);
    d = fijarCocinaLegado(d, { lavaplatos: 'doble' });
    expect(lavaplatos(d)).toMatchObject({ modelo: 'doble', llave: true });
    expect(nombreModulo(d.cuerpos[0])).toBe('Horno');
    expect(validarDiseno(d)).toEqual([]);
  });

  it('la cocina infantil conserva su equipamiento de juguete', () => {
    const d = disenoLibre('cocina-infantil');
    expect(d.equipos).toMatchObject([
      { tipo: 'encimera', platos: '2', modulo: d.cuerpos[2].id, campana: false },
      { tipo: 'lavaplatos', modelo: 'simple', modulo: d.cuerpos[1].id, llave: false },
    ]);
    expect(ejecutar(d, { op: 'agregarEquipo', equipo: 'campana' }).motivo).toMatch(/no lleva campana/);
    expect(ejecutar(d, { op: 'moverEquipo', id: encimera(d).id, tramo: 'base', modulo: 0 }).motivo).toMatch(/despensa/);
    expect(validarDiseno(d)).toEqual([]);
  });
});
