// Módulos: largo fijo al agregar y quitar (en las cocinas solo ceden las cajoneras y los abatibles),
// cajoneras de hasta 90 cm, puertas de 35 cm, especiero y apertura de las puertas.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clasificarProducto, cuerpo, disenoInicial, disenoLibre } from '../shared/catalogo';
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
  fijarLado,
  limitesModulo,
  normalizar,
  presetsModulo,
  quitarCuerpo,
  rolModulo,
} from '../shared/reglas';
import { repartirParejo } from '../shared/reparto';
import { validarDiseno } from '../shared/validar';
import type { Cuerpo, Diseno, ProductoTienda, Tramo } from '../shared/tipos';

const preset = (id: string, tramo: Tramo = 'base', p: Diseno['plantilla'] = 'cocina') => presetsModulo(p, tramo).find((x) => x.id === id)!;
const anchos = (d: Diseno, t: Tramo = 'base') => cuerposDe(d, t).map((c) => c.ancho);
const suma = (d: Diseno, t: Tramo = 'base') => anchos(d, t).reduce((a, b) => a + b, 0);
/** Cocina de 250 cm como la que pide un cliente: full equipo agrandada. */
const cocina250 = () => fijarAncho(disenoLibre('cocina'), 2500);

/**
 * Cocina con cajoneras que tienen de dónde ceder: [horno 60 + encimera][cajoneras…][1 puerta 35 + lavaplatos],
 * con las cajoneras repartidas alrededor de la puerta. Mide la suma de sus módulos.
 */
const cocinaConCajoneras = (cajoneras: number[] = [800, 750]) => {
  const d = cocina250();
  const [horno, , lav] = d.cuerpos;
  const cajs = cajoneras.map((ancho) => cuerpo({ ancho, cajones: 3 }));
  const cuerpos = [horno, cajs[0], { ...lav, ancho: 350 }, ...cajs.slice(1)];
  const ancho = cuerpos.reduce((a, c) => a + c.ancho, 0);
  return normalizar({ ...d, ancho, cuerpos, equipos: d.equipos.map((e) => (e.tipo === 'encimera' ? { ...e, modulo: horno.id } : e)) });
};
const cajonerasDe = (d: Diseno, t: Tramo = 'base') => cuerposDe(d, t).filter((c) => c.tipo === 'frentes' && c.cajones > 0 && c.puertas === 0);

describe('el mueble no crece ni se achica al agregar o quitar módulos', () => {
  it('una cocina de 250 cm sigue midiendo 250 cm: el módulo de 1 puerta entra con 35 cm y solo ceden las cajoneras', () => {
    let d = cocinaConCajoneras();
    expect(d.ancho).toBe(2500);
    expect(anchos(d)).toEqual([600, 800, 350, 750]);
    expect(validarDiseno(d)).toEqual([]);
    d = agregarModulo(d, preset('puerta'), 2);
    // Horno 60 y puerta 35 (con el lavaplatos) conservan su ancho; las cajoneras ceden parejo los 35 cm.
    expect(anchos(d)).toEqual([600, 600, 350, 350, 600]);
    expect(d.cuerpos[2]).toMatchObject({ puertas: 1, cajones: 0, ancho: 350 });
    expect(d.ancho).toBe(2500);
    expect(suma(d)).toBe(2500);
    expect(validarDiseno(d)).toEqual([]);
    // Al quitarlo, las cajoneras vuelven a tomar el espacio, parejas.
    d = quitarCuerpo(d, 2);
    expect(anchos(d)).toEqual([600, 775, 350, 775]);
    expect(d.ancho).toBe(2500);
  });

  it('los módulos de 2 puertas entran con 70 cm y las cajoneras se reparten parejo lo que queda', () => {
    let d = cocinaConCajoneras([900, 900, 900]);
    expect(d.ancho).toBe(3650);
    d = agregarModulo(d, preset('dos-puertas'), 1);
    expect(anchos(d)).toEqual([600, 700, 667, 350, 667, 666]);
    expect(d.cuerpos[1]).toMatchObject({ puertas: 2, ancho: 700 });
    expect(suma(d)).toBe(3650);
    expect(validarDiseno(d)).toEqual([]);
  });

  it('el horno, el especiero, el espacio libre y las puertas conservan su ancho; ceden solo las cajoneras', () => {
    const d0 = cocinaConCajoneras([900, 900, 900]);
    const h = agregarModulo(d0, preset('horno'), 4);
    expect(anchos(h)).toEqual([600, 700, 350, 700, 600, 700]);
    expect(h.cuerpos.map((c) => c.tipo)).toEqual(['horno', 'frentes', 'frentes', 'frentes', 'horno', 'frentes']);
    expect(validarDiseno(h)).toEqual([]);
    expect(h.cuerpos[4].ancho).toBe(ANCHO_HORNO);
    const e = agregarModulo(d0, preset('especiero'), 1);
    expect(e.cuerpos[1].ancho).toBe(ANCHO_ESPECIERO);
    expect(anchos(e)).toEqual([600, 200, 834, 350, 833, 833]);
    // El espacio libre entra con 50 cm y conserva su ancho al agregar y quitar otros módulos.
    let l = agregarModulo(d0, preset('hueco'), 4);
    expect(anchos(l)).toEqual([600, 734, 350, 733, 500, 733]);
    // Ahora es ajustable (20 a 50 cm), pero mientras las cajoneras alcanzan no se toca.
    expect(rolModulo(l, 'base', l.cuerpos[4])).toBe('ajustable');
    l = agregarModulo(l, preset('puerta'), 1);
    expect(anchos(l)).toEqual([600, 350, 617, 350, 617, 500, 616]);
    l = quitarCuerpo(l, 1);
    expect(anchos(l)).toEqual([600, 734, 350, 733, 500, 733]);
    expect(l.cuerpos[4].tipo).toBe('hueco');
    for (const x of [h, e, l]) expect(x.ancho).toBe(3650);
  });

  it('las cajoneras quedan entre 60 y 90 cm al agregar o quitar mientras ellas solas alcanzan', () => {
    let d = cocinaConCajoneras([900, 900, 900]);
    const ops = ['puerta', 'dos-puertas', 'puerta', 'especiero', 'puerta', 'cajonera', 'dos-puertas'];
    let soloCajoneras = 0;
    // Si ninguno de los demás módulos cambió, el reparto fue de nivel 1 y las cajoneras quedan en 60–90 cm.
    const revisar = (antes: Diseno, despues: Diseno) => {
      const previos = new Map(antes.cuerpos.map((c) => [c.id, c.ancho]));
      const otros = despues.cuerpos.filter((c) => previos.has(c.id) && !cajonerasDe(despues).includes(c));
      if (otros.some((c) => c.ancho !== previos.get(c.id))) return;
      soloCajoneras++;
      // (Una cajonera que ya medía menos de 60 cm no se achica más.)
      for (const c of cajonerasDe(despues).filter((c) => previos.has(c.id))) {
        expect(c.ancho).toBeGreaterThanOrEqual(Math.min(600, previos.get(c.id)!));
        expect(c.ancho).toBeLessThanOrEqual(900);
      }
    };
    for (const id of ops) {
      const r = ejecutar(d, { op: 'agregarModulo', tramo: 'base', preset: id, posicion: 1 });
      if (!r.ok) continue;
      revisar(d, r.diseno);
      d = r.diseno;
      expect(d.ancho).toBe(3650);
      expect(validarDiseno(d)).toEqual([]);
    }
    expect(soloCajoneras).toBeGreaterThan(0);
    while (true) {
      const i = d.cuerpos.findIndex((c, k) => k > 0 && c.tipo === 'frentes' && c.puertas > 0 && !d.equipos.some((e) => e.modulo === c.id));
      if (i < 0) break;
      const r = ejecutar(d, { op: 'quitarModulo', tramo: 'base', modulo: i });
      if (!r.ok) {
        expect(r.motivo).toMatch(/sin cubrir: agrega una cajonera/);
        break;
      }
      revisar(d, r.diseno);
      d = r.diseno;
      expect(d.ancho).toBe(3650);
    }
    // Una cajonera que ya medía menos de 60 cm no se achica más mientras otras puedan ceder.
    const angosta = cocinaConCajoneras([500, 900]);
    const ra = ejecutar(angosta, { op: 'agregarModulo', tramo: 'base', preset: 'especiero' });
    expect(ra.ok).toBe(true);
    expect(Math.min(...cajonerasDe(ra.diseno).map((c) => c.ancho))).toBeGreaterThanOrEqual(500);
  });

  it('cambiar a mano el ancho de un módulo de puertas se conserva al agregar o quitar otros', () => {
    let d = cocinaConCajoneras([900, 900, 900]);
    d = fijarAnchoCuerpo(d, 2, 500);
    expect(d.cuerpos[2].ancho).toBe(500);
    expect(d.ancho).toBe(3650);
    d = agregarModulo(d, preset('puerta'), 1);
    expect(d.cuerpos[3].ancho).toBe(500);
    d = quitarCuerpo(d, 1);
    expect(d.cuerpos[2].ancho).toBe(500);
    expect(d.ancho).toBe(3650);
  });

  it('si no cabe, se rechaza con cuánto falta o sobra y qué agregar o quitar, sin ofrecer agrandar el mueble', () => {
    // Ahora casi todo cabe (nivel 3: los ajustables bajan hasta su mínimo); un 2 puertas entra en 250 cm.
    const d = cocinaConCajoneras();
    const ok = ejecutar(d, { op: 'agregarModulo', tramo: 'base', preset: 'dos-puertas' });
    expect(ok.ok).toBe(true);
    expect(suma(ok.diseno)).toBe(2500);
    expect(validarDiseno(ok.diseno)).toEqual([]);
    // Se agregan hornos (60 cm fijos) hasta que no cabe otro: se rechaza con cuánto falta y qué quitar.
    let h = d;
    let r = ejecutar(h, { op: 'agregarModulo', tramo: 'base', preset: 'horno' });
    while (r.ok) {
      h = r.diseno;
      expect(suma(h)).toBe(2500);
      r = ejecutar(h, { op: 'agregarModulo', tramo: 'base', preset: 'horno' });
    }
    expect(r.diseno).toBe(h);
    expect(r.motivo).toMatch(/^No cabe «Horno empotrado» en la medida del tramo principal \(250 cm\)\. Faltan \d+ cm para que quepa: quita puertas \(35 cm cada una\) o una cajonera, o elige módulos más angostos\.$/);
    expect(r).not.toHaveProperty('alternativa');
    expect(r.motivo).not.toMatch(/agrand|achic/);
    // Quitar: si lo que queda no puede cubrir el espacio (horno fijo, ajustable de hasta 90 cm), se rechaza.
    const q = ejecutar(cocina250(), { op: 'quitarModulo', tramo: 'base', modulo: 1 });
    expect(q.ok).toBe(true);
    expect(anchos(q.diseno)).toEqual([600, 1900]);
    const q2 = ejecutar(q.diseno, { op: 'quitarModulo', tramo: 'base', modulo: 1 });
    expect(q2.ok).toBe(false);
    expect(q2.motivo).toBe(
      'No se puede quitar el módulo 2 sin cambiar la medida del tramo principal (250 cm). Quedarían 190 cm sin cubrir: agrega una cajonera (de 60 cm a 90 cm) o puertas (35 cm cada una).',
    );
    // Sin cajoneras que puedan ceder, cede el módulo de la encimera y lavaplatos (ajustable) y la puerta entra con 35 cm.
    const r3 = ejecutar(cocina250(), { op: 'agregarModulo', tramo: 'base', preset: 'puerta' });
    expect(r3.ok).toBe(true);
    expect(anchos(cocina250())).toEqual([600, 900, 1000]);
    expect(anchos(r3.diseno)).toEqual([600, 775, 775, 350]);
    expect(suma(r3.diseno)).toBe(2500);
    expect(validarDiseno(r3.diseno)).toEqual([]);
  });

  it('en los muebles que no son de cocina el nuevo y los ajustables se siguen repartiendo parejo', () => {
    let d = disenoLibre('closet');
    const id = presetsModulo('closet', 'base')[0].id;
    d = ejecutar(d, { op: 'agregarModulo', tramo: 'base', preset: id }).diseno;
    const a = anchos(d);
    expect(a).toHaveLength(4);
    expect(suma(d)).toBe(d.ancho);
    expect(Math.max(...a) - Math.min(...a)).toBeLessThanOrEqual(1);
    d = quitarCuerpo(d, 0);
    const b = anchos(d);
    expect(suma(d)).toBe(d.ancho);
    expect(Math.max(...b) - Math.min(...b)).toBeLessThanOrEqual(1);
  });

  it('el ancho solo cambia cuando el vendedor cambia la medida del mueble', () => {
    const d = cocina250();
    expect(agregarModulo(d, preset('puerta'), 1).ancho).toBe(2500);
    expect(quitarCuerpo(d, 1).ancho).toBe(2500);
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

  it('en un lado de la U ceden las cajoneras y en los aéreos los abatibles; las puertas conservan 35 cm por puerta', () => {
    let d = fijarForma(cocina250(), 'U');
    const caj = { ...preset('cajonera', 'der'), ancho: 900 };
    d = agregarModulo(d, caj, 0, 'der', true);
    d = agregarModulo(d, caj, 0, 'der', true);
    const largoDer = d.lados.der!.largo;
    const util = largoDer - d.profundidad;
    expect(anchos(d, 'der')).toEqual([900, 900, 600]);
    d = agregarModulo(d, preset('puerta', 'der'), 1, 'der');
    expect(d.lados.der!.largo).toBe(largoDer);
    expect(anchos(d, 'der')).toEqual([725, 350, 725, 600]);
    expect(suma(d, 'der')).toBe(util);
    d = quitarCuerpo(d, 1, 'der');
    expect(anchos(d, 'der')).toEqual([900, 900, 600]);
    // Aéreos: los abatibles absorben y las puertas nuevas conservan 35 cm por puerta.
    let a = activarAereos(fijarAncho(disenoLibre('cocina'), 3000), true);
    for (const i of [0, 1, 2]) a = actualizarCuerpo(a, i, { puertas: 1, abatible: true }, 'aereos');
    expect(anchos(a, 'aereos')).toEqual([750, 750, 750, 750]);
    const largoA = suma(a, 'aereos');
    a = agregarModulo(a, preset('aereo-puerta', 'aereos'), 3, 'aereos');
    expect(anchos(a, 'aereos')).toEqual([634, 633, 633, 350, 750]);
    expect(a.aereos.cuerpos[3]).toMatchObject({ puertas: 1, ancho: 350 });
    expect(suma(a, 'aereos')).toBe(largoA);
    expect(validarDiseno(a)).toEqual([]);
    // Un 2 puertas más ya no cabe con los abatibles en 60 cm: ceden también las puertas (nivel 2) y el largo no cambia.
    const r = ejecutar(a, { op: 'agregarModulo', tramo: 'aereos', preset: 'aereo-dos' });
    expect(r.ok).toBe(true);
    expect(suma(r.diseno, 'aereos')).toBe(largoA);
    expect(validarDiseno(r.diseno)).toEqual([]);
    a = quitarCuerpo(a, 3, 'aereos');
    expect(anchos(a, 'aereos')).toEqual([750, 750, 750, 750]);
    expect(validarDiseno(a)).toEqual([]);
  });

  it('la campana y el nicho miden siempre 60 cm y el espacio libre de 20 a 50 cm', () => {
    const d = activarAereos(cocina250(), true);
    const nicho = cuerpo({ tipo: 'nicho', ancho: 600, puertas: 1, abatible: true });
    const campana = cuerpo({ tipo: 'campana', ancho: 600, puertas: 2 });
    for (const c of [nicho, campana]) {
      expect(limitesModulo(d, 'aereos', c)).toEqual({ min: 600, max: 600 });
      expect(rolModulo(d, 'aereos', c)).toBe('fijo');
    }
    expect(preset('nicho', 'aereos').ancho).toBe(600);
    expect(preset('hueco').ancho).toBe(500);
    expect(preset('hueco', 'aereos').ancho).toBe(500);
    expect(limitesModulo(d, 'base', cuerpo({ tipo: 'hueco', ancho: 500 }))).toEqual({ min: 200, max: 500 });
    // El nicho del compacto también mide 60 cm.
    const c = disenoLibre('compacto');
    expect(c.aereos.cuerpos.find((x) => x.tipo === 'nicho')!.ancho).toBe(600);
    expect(validarDiseno(c)).toEqual([]);
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

describe('reparto parejo (repartirParejo)', () => {
  const lim = (max = Infinity, min = 150) => ({ min, max });
  it('reparte en partes iguales al milímetro y sin perder ni sobrar', () => {
    expect(repartirParejo(2500, [lim(), lim(), lim()])).toEqual([834, 833, 833]);
    expect(repartirParejo(1000, [lim(), lim(), lim(), lim(), lim(), lim()])).toEqual([167, 167, 167, 167, 166, 166]);
    for (const [total, n] of [[2501, 7], [1999, 3], [3600, 11]]) {
      const r = repartirParejo(total, Array.from({ length: n }, () => lim()))!;
      expect(r.reduce((a, b) => a + b, 0)).toBe(total);
      expect(Math.max(...r) - Math.min(...r)).toBeLessThanOrEqual(1);
    }
  });
  it('la cajonera queda en 90 cm y el resto se reparte entre los demás; null si no caben', () => {
    expect(repartirParejo(3600, [lim(900), lim(), lim(900)])).toEqual([900, 1800, 900]);
    expect(repartirParejo(400, [lim(), lim(), lim()])).toBeNull();
    expect(repartirParejo(2000, [lim(900), lim(900)])).toBeNull();
  });
});

describe('cajoneras', () => {
  it('una cajonera mide como máximo 90 cm en los ajustes automáticos; a mano puede pasar', () => {
    const d = cocina250();
    expect(limitesModulo(d, 'base', d.cuerpos[1]).max).toBe(ANCHO_MAX_CAJONERA);
    // [horno 60][cajonera 60][2 puertas 80][lavaplatos 70]: la cajonera pide 110 y llega a 90.
    const base = fijarAnchoCuerpo(agregarModulo(fijarAncho(disenoLibre('cocina'), 2000), preset('dos-puertas'), 2, 'base', true), 1, 600);
    expect(anchos(base)).toEqual([600, 600, 800, 700]);
    // A mano el vendedor puede pasar los 90 cm: la cajonera queda en 110 y ceden los vecinos.
    const r = ejecutar(base, { op: 'fijarAnchoModulo', tramo: 'base', modulo: 1, ancho: 1100 });
    expect(r.ok).toBe(true);
    expect(r.diseno.cuerpos[1].ancho).toBe(1100);
    expect(suma(r.diseno)).toBe(suma(base));
    // Agregar una cajonera de 1,2 m la deja en 90 cm (las demás cajoneras ceden parejo).
    const holgada = cocinaConCajoneras([900, 900, 900]);
    const ancha = agregarCuerpo(holgada, 'frentes', 1, { cambios: { cajones: 4 }, ancho: 1200 });
    expect(ancha.ancho).toBe(holgada.ancho);
    expect(ancha.cuerpos[1]).toMatchObject({ cajones: 4, ancho: 900 });
    expect(anchos(ancha)).toEqual([600, 900, 600, 350, 600, 600]);
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
    // En la cocina uno nuevo sin ancho pedido entra con 35 cm por puerta y ceden las cajoneras…
    const base = cocinaConCajoneras([900, 900, 900]);
    expect(anchos(agregarCuerpo(base, 'frentes', undefined, { cambios: { puertas: 2 } }))).toEqual([600, 667, 350, 667, 666, 700]);
    // …y con un ancho pedido (a mano) lo conserva.
    const d = agregarCuerpo(base, 'frentes', undefined, { cambios: { puertas: 2 }, ancho: 500 });
    expect(anchos(d)).toEqual([600, 734, 350, 733, 733, 500]);
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
    const u = agregarModulo(fijarForma(cocina250(), 'U'), { ...preset('cajonera', 'der'), ancho: 900 }, 0, 'der', true);
    const m = agregarModulo(u, preset('especiero', 'der'), 0, 'der');
    expect(m.lados.der!.cuerpos[0]).toMatchObject({ tipo: 'especiero', ancho: 200 });
    expect(anchos(m, 'der')).toEqual([200, 700, 600]);
    const a = activarAereos(cocina250(), true);
    expect(ejecutar(a, { op: 'agregarCuerpo', tramo: 'aereos', tipo: 'especiero' }).ok).toBe(false);
  });

  it('un módulo puede pasar a especiero tomando o cediendo espacio a sus vecinos', () => {
    const d = agregarModulo(cocinaConCajoneras([900, 900, 900]), preset('puerta'), 1);
    expect(d.cuerpos[1].ancho).toBe(350);
    const m = actualizarCuerpo(d, 1, { tipo: 'especiero' });
    expect(m.cuerpos[1].ancho).toBe(200);
    expect(m.ancho).toBe(3650);
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

describe('reparto por niveles al agregar módulos en cocinas', () => {
  const productos = JSON.parse(fs.readFileSync('public/datos/productos-respaldo.json', 'utf8')) as ProductoTienda[];
  const prod = (id: number) => clasificarProducto(productos.find((x) => x.id === id)!);

  it('un lado de L o U con un solo módulo de 2 puertas de 190 cm acepta una cajonera y un módulo de 1 puerta', () => {
    for (const [forma, lado] of [['der', 'der'], ['U', 'izq']] as const) {
      const d = fijarLado(fijarForma(fijarAncho(disenoInicial(prod(16)), 2400), forma), lado, { largo: 2500 });
      expect(cuerposDe(d, lado).map((c) => [c.puertas, c.ancho])).toEqual([[2, 1900]]);
      // Nivel 1 no alcanza (no hay cajoneras): cede la puerta y la cajonera nueva queda en 90 cm.
      const c = ejecutar(d, { op: 'agregarModulo', tramo: lado, preset: 'cajonera' });
      expect(c.ok).toBe(true);
      expect(anchos(c.diseno, lado)).toEqual([1000, 900]);
      expect(suma(c.diseno, lado)).toBe(1900);
      expect(validarDiseno(c.diseno)).toEqual([]);
      // Un módulo de 1 puerta entra con sus 35 cm.
      const p = ejecutar(d, { op: 'agregarModulo', tramo: lado, preset: 'puerta' });
      expect(p.ok).toBe(true);
      expect(anchos(p.diseno, lado)).toEqual([1550, 350]);
      expect(validarDiseno(p.diseno)).toEqual([]);
    }
  });

  it('en la cocina XL, fijar la cajonera en 70 cm achica los módulos de puertas equipados', () => {
    const d = disenoInicial(prod(160));
    expect(anchos(d)).toEqual([670, 460, 670]);
    const r = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: 1, ancho: 700 });
    expect(r.ok).toBe(true);
    expect(anchos(r.diseno)).toEqual([550, 700, 550]);
    expect(r.diseno.ancho).toBe(d.ancho);
    expect(validarDiseno(r.diseno)).toEqual([]);
  });

  it('en secuencias al azar el total no cambia, los fijos conservan su medida y el diseño queda válido', () => {
    let semilla = 12345;
    const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const ids = presetsModulo('cocina', 'base').map((p) => p.id);
    const fijos = new Set<Cuerpo['tipo']>(['horno', 'especiero', 'nicho', 'campana']);
    let aceptados = 0;
    let nivel1 = 0;
    for (let caso = 0; caso < 30; caso++) {
      let d = fijarAncho(disenoInicial(prod(azar() < 0.5 ? 16 : 160)), 1800 + Math.floor(azar() * 16) * 100);
      const total = d.ancho;
      for (let paso = 0; paso < 8; paso++) {
        const antes = new Map(cuerposDe(d, 'base').map((c) => [c.id, c.ancho]));
        const r = ejecutar(d, { op: 'agregarModulo', tramo: 'base', preset: ids[Math.floor(azar() * ids.length)], posicion: Math.floor(azar() * (antes.size + 1)) });
        if (!r.ok) {
          expect(r.diseno).toBe(d);
          expect(r.motivo).toMatch(/Faltan \d+ cm para que quepa|Quedarían \d+ cm sin cubrir/);
          continue;
        }
        aceptados++;
        d = r.diseno;
        expect(d.ancho).toBe(total);
        expect(suma(d)).toBe(total);
        expect(validarDiseno(d)).toEqual([]);
        const previos = cuerposDe(d, 'base').filter((c) => antes.has(c.id));
        for (const c of previos) if (fijos.has(c.tipo)) expect(c.ancho).toBe(antes.get(c.id));
        // Si solo cambiaron las cajoneras, alcanzó el nivel 1: quedan entre 60 y 90 cm (o no se achican si ya medían menos).
        const cajs = cajonerasDe(d);
        if (previos.every((c) => cajs.includes(c) || c.ancho === antes.get(c.id))) {
          nivel1++;
          for (const c of previos.filter((c) => cajs.includes(c))) {
            expect(c.ancho).toBeGreaterThanOrEqual(Math.min(600, antes.get(c.id)!));
            expect(c.ancho).toBeLessThanOrEqual(900);
          }
        }
      }
    }
    expect(aceptados).toBeGreaterThan(100);
    expect(nivel1).toBeGreaterThan(0);
  });

  it('una cocina full equipo de 250 cm acepta varios módulos de puertas seguidos sin cambiar su medida', () => {
    let d = cocina250();
    for (let k = 0; k < 5; k++) {
      const r = ejecutar(d, { op: 'agregarModulo', tramo: 'base', preset: k % 2 ? 'dos-puertas' : 'puerta' });
      expect(r.ok, `módulo ${k + 1}`).toBe(true);
      d = r.diseno;
      expect(d.ancho).toBe(2500);
      expect(suma(d)).toBe(2500);
      expect(validarDiseno(d)).toEqual([]);
    }
    expect(d.cuerpos).toHaveLength(8);
    expect(d.cuerpos[0]).toMatchObject({ tipo: 'horno', ancho: 600 });
  });
});
