// Módulos: largo fijo al agregar y quitar, cajoneras de hasta 90 cm, puertas de 35 cm,
// especiero y apertura de las puertas.
import { describe, expect, it } from 'vitest';
import { cuerpo, disenoLibre } from '../shared/catalogo';
import { aperturaAjustable, bisagraDe, calcularLayout, calcularLayoutAereos, disenoLado } from '../shared/layout';
import {
  ANCHO_ESPECIERO,
  ANCHO_HORNO,
  ANCHO_MAX_CAJONERA,
  activarAereos,
  actualizarCuerpo,
  agregarCuerpo,
  agregarModulo,
  cuerposDe,
  ejecutar,
  fijarAncho,
  fijarAnchoCuerpo,
  fijarForma,
  limitesModulo,
  normalizar,
  presetsModulo,
  quitarCuerpo,
  rolModulo,
} from '../shared/reglas';
import { validarDiseno } from '../shared/validar';
import type { Cuerpo, Diseno, Tramo } from '../shared/tipos';

const preset = (id: string, tramo: Tramo = 'base', p: Diseno['plantilla'] = 'cocina') => presetsModulo(p, tramo).find((x) => x.id === id)!;
const anchos = (d: Diseno, t: Tramo = 'base') => cuerposDe(d, t).map((c) => c.ancho);
const suma = (d: Diseno, t: Tramo = 'base') => anchos(d, t).reduce((a, b) => a + b, 0);
/** Cocina de 250 cm como la que pide un cliente: full equipo agrandada. */
const cocina250 = () => fijarAncho(disenoLibre('cocina'), 2500);

describe('el mueble no crece ni se achica al agregar o quitar módulos', () => {
  it('una cocina de 250 cm sigue midiendo 250 cm al agregar varios módulos', () => {
    let d = cocina250();
    expect(anchos(d)).toEqual([600, 900, 1000]);
    for (const id of ['puerta', 'dos-puertas', 'cajonera', 'especiero']) {
      const antes = d;
      d = agregarModulo(d, preset(id), 1);
      expect(d, id).not.toBe(antes);
      expect(d.ancho).toBe(2500);
      expect(suma(d)).toBe(2500);
      expect(validarDiseno(d)).toEqual([]);
    }
    // El horno (60), el especiero (20) y el módulo del lavaplatos (100) conservan su ancho.
    expect(d.cuerpos.find((c) => c.tipo === 'horno')!.ancho).toBe(ANCHO_HORNO);
    expect(d.cuerpos.find((c) => c.tipo === 'especiero')!.ancho).toBe(ANCHO_ESPECIERO);
    const lav = d.equipos.find((e) => e.tipo === 'lavaplatos')!;
    expect(d.cuerpos.find((c) => c.id === lav.modulo)!.ancho).toBe(1000);
  });

  it('el módulo nuevo toma su ancho de los ajustables más cercanos', () => {
    const d = agregarModulo(cocina250(), preset('puerta'), 2);
    // Se insertó entre la cajonera y el lavaplatos: cede la cajonera.
    expect(anchos(d)).toEqual([600, 550, 350, 1000]);
    expect(d.cuerpos[2]).toMatchObject({ puertas: 1, ancho: 350 });
  });

  it('al quitar un módulo su espacio pasa a los vecinos ajustables', () => {
    let d = agregarModulo(cocina250(), preset('dos-puertas'), 2);
    expect(anchos(d)).toEqual([600, 200, 700, 1000]);
    d = quitarCuerpo(d, 2);
    expect(anchos(d)).toEqual([600, 900, 1000]);
    expect(d.ancho).toBe(2500);
  });

  it('si no hay espacio la operación se rechaza y se explica por qué', () => {
    let d = cocina250();
    for (let i = 0; i < 4; i++) d = agregarModulo(d, preset('dos-puertas'), 1);
    expect(Math.min(...anchos(d).filter((_, i) => rolModulo(d, 'base', d.cuerpos[i]) === 'ajustable'))).toBe(150);
    const r = ejecutar(d, { op: 'agregarModulo', tramo: 'base', preset: 'horno' });
    expect(r.ok).toBe(false);
    expect(r.diseno).toBe(d);
    expect(r.motivo).toMatch(/No hay espacio para «Horno empotrado» de 60 cm/);
    // Quitar un módulo cuando solo quedan fijos o equipados también se rechaza.
    const f = disenoLibre('cocina');
    const sinAjustables = quitarCuerpo(quitarCuerpo(f, 1, 'base', true), 0, 'base');
    expect(sinAjustables.cuerpos).toHaveLength(2);
    const r2 = ejecutar(sinAjustables, { op: 'quitarModulo', tramo: 'base', modulo: 0 });
    expect(r2.ok).toBe(false);
    expect(r2.motivo).toMatch(/medida fija o equipamiento/);
  });

  it('el ancho solo cambia cuando el vendedor cambia la medida (o lo pide al agregar o quitar)', () => {
    const d = cocina250();
    expect(agregarModulo(d, preset('puerta'), 1, 'base', true).ancho).toBe(2850);
    expect(quitarCuerpo(d, 1, 'base', true).ancho).toBe(1600);
    const r = ejecutar(d, { op: 'fijarAncho', ancho: 2000 });
    expect(r.diseno.ancho).toBe(2000);
    expect(validarDiseno(r.diseno)).toEqual([]);
  });

  it('los módulos con horno, lavaplatos o encimera conservan su ancho al repartir', () => {
    let d = agregarModulo(cocina250(), preset('puerta'), undefined, 'base', true);
    const equipados = d.cuerpos.filter((c) => rolModulo(d, 'base', c) !== 'ajustable').map((c) => [c.id, c.ancho]);
    d = fijarAncho(d, 2300);
    for (const [id, ancho] of equipados) expect(d.cuerpos.find((c) => c.id === id)!.ancho).toBe(ancho);
    d = agregarModulo(d, preset('cajonera'), 0);
    for (const [id, ancho] of equipados) expect(d.cuerpos.find((c) => c.id === id)!.ancho).toBe(ancho);
  });

  it('en los lados de la L y en los aéreos rige lo mismo', () => {
    let d = activarAereos(fijarForma(cocina250(), 'izq'), true);
    const largoL = d.lados.izq!.largo;
    const largoA = suma(d, 'aereos');
    d = agregarModulo(d, preset('especiero', 'izq'), 0, 'izq');
    d = agregarModulo(d, preset('aereo-puerta', 'aereos'), 0, 'aereos');
    expect(d.lados.izq!.largo).toBe(largoL);
    expect(suma(d, 'izq')).toBe(largoL - d.profundidad);
    expect(suma(d, 'aereos')).toBe(largoA);
    d = quitarCuerpo(d, 0, 'aereos');
    expect(suma(d, 'aereos')).toBe(largoA);
    expect(validarDiseno(d)).toEqual([]);
  });
});

describe('cajoneras', () => {
  it('una cajonera mide como máximo 90 cm', () => {
    const d = cocina250();
    expect(limitesModulo(d, 'base', d.cuerpos[1]).max).toBe(ANCHO_MAX_CAJONERA);
    // [horno 60][cajonera 60][2 puertas 100][lavaplatos 50]: la cajonera pide 110 y llega a 90.
    const base = fijarAnchoCuerpo(agregarModulo(fijarAncho(disenoLibre('cocina'), 2000), preset('dos-puertas'), 2, 'base', true), 1, 600);
    expect(anchos(base)).toEqual([600, 600, 1000, 500]);
    const r = ejecutar(base, { op: 'fijarAnchoModulo', tramo: 'base', modulo: 1, ancho: 1100 });
    expect(anchos(r.diseno)).toEqual([600, 900, 700, 500]);
    expect(r.avisos.join(' ')).toMatch(/máximo de una cajonera/);
    // Agregar una cajonera de 1,2 m la deja en 90 cm.
    const holgada = agregarModulo(fijarAncho(disenoLibre('cocina'), 2400), preset('dos-puertas'), 3, 'base', true);
    const ancha = agregarCuerpo(holgada, 'frentes', 1, { cambios: { cajones: 4 }, ancho: 1200 });
    expect(ancha.ancho).toBe(holgada.ancho);
    expect(ancha.cuerpos[1]).toMatchObject({ cajones: 4, ancho: 900 });
    // Pasar un módulo ancho a cajonera lo achica a 90 cm y el resto va a los vecinos.
    let m = agregarModulo(fijarAncho(disenoLibre('cocina'), 3000), preset('dos-puertas'), 3, 'base', true);
    m = fijarAnchoCuerpo(m, 3, 1100);
    const antes = m.ancho;
    m = actualizarCuerpo(m, 3, { puertas: 0, cajones: 4 });
    expect(m.cuerpos[3].ancho).toBe(900);
    expect(m.ancho).toBe(antes);
    expect(validarDiseno(m)).toEqual([]);
  });

  it('el mueble no pasa lo que permiten sus cajoneras y medidas fijas', () => {
    const r = ejecutar(disenoLibre('cocina'), { op: 'fijarAncho', ancho: 3600 });
    // Cajonera 90 + horno 60: lo demás lo toma el módulo del lavaplatos.
    expect(anchos(r.diseno)).toEqual([600, 900, 2100]);
  });

  it('los muebles que no son de cocina no tienen ese máximo', () => {
    const c = fijarAncho(disenoLibre('comoda'), 1500);
    expect(c.cuerpos[0].ancho).toBe(1500);
  });
});

describe('puertas de 35 cm por puerta', () => {
  it('los módulos de puertas se agregan con 35 cm por puerta', () => {
    for (const t of ['base', 'izq', 'aereos'] as Tramo[]) {
      const ps = presetsModulo('cocina', t);
      const una = ps.find((p) => p.cambios.puertas === 1 && !p.cambios.abatible && !p.cambios.cajones)!;
      const dos = ps.find((p) => p.cambios.puertas === 2)!;
      expect(una.ancho, t).toBe(350);
      expect(dos.ancho, t).toBe(700);
    }
    expect(preset('dos-puertas', 'base', 'compacto').ancho).toBe(700);
    // Un módulo de puertas sin ancho indicado también parte en 35 cm por puerta.
    const d = agregarCuerpo(fijarAncho(disenoLibre('cocina'), 3000), 'frentes', undefined, { cambios: { puertas: 2 } });
    expect(d.cuerpos.at(-1)!.ancho).toBe(700);
  });
});

describe('especiero', () => {
  it('es un extraíble de 20 cm fijos y alto completo con 2 pisos (3 si se pide)', () => {
    const p = preset('especiero');
    expect(p).toMatchObject({ tipo: 'especiero', ancho: 200, anchoMinimo: 200, cambios: { pisos: 2 } });
    let d = agregarModulo(cocina250(), p, 1);
    const e = d.cuerpos[1];
    expect(e).toMatchObject({ tipo: 'especiero', ancho: 200, pisos: 2, puertas: 0, cajones: 0 });
    const l = calcularLayout(d);
    const frente = l.frentes.find((f) => f.cuerpo === 1)!;
    expect(frente).toMatchObject({ tipo: 'cajon', especiero: true });
    // Alto completo: del zócalo a la cubierta, como las puertas de los demás módulos.
    const puerta = l.frentes.find((f) => f.tipo === 'puerta')!;
    expect(frente.rect.y0).toBeCloseTo(puerta.rect.y0);
    expect(frente.rect.y1).toBeCloseTo(puerta.rect.y1);
    expect(l.cuerpos[1].especiero!.pisos).toHaveLength(2);
    d = actualizarCuerpo(d, 1, { pisos: 3 });
    expect(calcularLayout(d).cuerpos[1].especiero!.pisos).toHaveLength(3);
    expect(actualizarCuerpo(d, 1, { pisos: 7 }).cuerpos[1].pisos).toBe(3);
    // Mide siempre 20 cm.
    expect(fijarAnchoCuerpo(d, 1, 400).cuerpos[1].ancho).toBe(200);
    expect(fijarAncho(d, 2000).cuerpos[1].ancho).toBe(200);
  });

  it('está en el mueble base y en los lados de la L/U, no en los aéreos', () => {
    expect(presetsModulo('cocina', 'base').some((p) => p.id === 'especiero')).toBe(true);
    expect(presetsModulo('cocina', 'izq').some((p) => p.id === 'especiero')).toBe(true);
    expect(presetsModulo('cocina', 'der').some((p) => p.id === 'especiero')).toBe(true);
    expect(presetsModulo('cocina', 'aereos').some((p) => p.id === 'especiero')).toBe(false);
    const u = fijarForma(cocina250(), 'U');
    const m = agregarModulo(u, preset('especiero', 'der'), 0, 'der');
    expect(m.lados.der!.cuerpos[0]).toMatchObject({ tipo: 'especiero', ancho: 200 });
    const a = activarAereos(cocina250(), true);
    expect(ejecutar(a, { op: 'agregarCuerpo', tramo: 'aereos', tipo: 'especiero' }).ok).toBe(false);
  });

  it('un módulo puede pasar a especiero tomando o cediendo espacio a sus vecinos', () => {
    const d = agregarModulo(cocina250(), preset('puerta'), 1);
    const m = actualizarCuerpo(d, 1, { tipo: 'especiero' });
    expect(m.cuerpos[1].ancho).toBe(200);
    expect(m.ancho).toBe(2500);
    expect(validarDiseno(m)).toEqual([]);
  });
});

describe('apertura de las puertas', () => {
  const modulo = (parcial: Partial<Cuerpo>) => cuerpo({ ancho: 900, ...parcial });

  it('se elige en la puerta única y en la impar de un módulo de 3', () => {
    expect(aperturaAjustable(modulo({ puertas: 1 }))).toBe(true);
    expect(aperturaAjustable(modulo({ puertas: 3 }))).toBe(true);
    expect(aperturaAjustable(modulo({ puertas: 2 }))).toBe(false);
    expect(aperturaAjustable(modulo({ puertas: 4 }))).toBe(false);
    expect(aperturaAjustable(modulo({ puertas: 1, abatible: true }))).toBe(false);
    expect(aperturaAjustable(modulo({ tipo: 'nicho', puertas: 1 }))).toBe(false);
    expect(aperturaAjustable(modulo({ tipo: 'campana', puertas: 1 }))).toBe(true);
    for (const bisagra of ['izq', 'der'] as const) {
      expect(bisagraDe(modulo({ puertas: 1, bisagra }), 0)).toBe(bisagra);
      const tres = modulo({ puertas: 3, bisagra });
      expect([0, 1, 2].map((k) => bisagraDe(tres, k))).toEqual([bisagra, 'izq', 'der']);
    }
    expect([0, 1].map((k) => bisagraDe(modulo({ puertas: 2 }), k))).toEqual(['izq', 'der']);
  });

  it('se ajusta en cualquier tramo: principal, lados y aéreos', () => {
    let d = activarAereos(fijarForma(cocina250(), 'U'), true);
    d = actualizarCuerpo(d, 0, { puertas: 1, bisagra: 'izq' }, 'der');
    d = actualizarCuerpo(d, 0, { puertas: 3, bisagra: 'der' }, 'izq');
    d = actualizarCuerpo(d, 0, { puertas: 1, bisagra: 'der' }, 'aereos');
    const der = calcularLayout(disenoLado(d, 'der')!).frentes.filter((f) => f.tipo === 'puerta' && f.cuerpo === 0);
    expect(der.map((f) => f.tipo === 'puerta' && f.bisagra)).toEqual(['izq']);
    const izq = calcularLayout(disenoLado(d, 'izq')!).frentes.filter((f) => f.tipo === 'puerta' && f.cuerpo === 0);
    expect(izq.map((f) => f.tipo === 'puerta' && f.bisagra)).toEqual(['der', 'izq', 'der']);
    const aereo = calcularLayoutAereos(d)!.frentes.filter((f) => f.cuerpo === 0);
    expect(aereo.map((f) => f.bisagra)).toEqual(['der']);
    expect(normalizar(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
});
