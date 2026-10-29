// Recomendaciones de puertas, cajones y módulos (sugerencias; todo sigue siendo editable).
import { describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import { cajonesIdeales, distribucionIdeal, puertasIdeales, recomendaciones } from '../shared/recomendaciones';
import { ejecutar } from '../shared/reglas';

describe('recomendaciones', () => {
  it('puertas de 35 cm con ±10: cada una entre 25 y 45 cm, lo más cerca de 35', () => {
    expect([250, 350, 450, 500, 700, 900, 1000, 1400].map(puertasIdeales)).toEqual([1, 1, 1, 2, 2, 2, 3, 4]);
  });

  it('3 cajones en un mueble de cocina de 90 cm', () => {
    expect(cajonesIdeales(900 - 100 - 28)).toBe(3);
  });

  it('distribuye el largo libre: cajonera de 40 (hasta 90) y módulos de 2 puertas de 35', () => {
    expect(distribucionIdeal(1100, true)).toEqual([
      { cantidad: 1, tipo: 'cajonera', puertas: 0, ancho: 400 },
      { cantidad: 1, tipo: 'puertas', puertas: 2, ancho: 700 },
    ]);
    expect(distribucionIdeal(1500, true)).toEqual([
      { cantidad: 1, tipo: 'cajonera', puertas: 0, ancho: 400 },
      { cantidad: 1, tipo: 'puertas', puertas: 2, ancho: 700 },
      { cantidad: 1, tipo: 'puertas', puertas: 1, ancho: 400 },
    ]);
    // Lo que sobra agranda la cajonera (sin pasar de 90).
    expect(distribucionIdeal(2000, true)).toEqual([
      { cantidad: 1, tipo: 'cajonera', puertas: 0, ancho: 600 },
      { cantidad: 2, tipo: 'puertas', puertas: 2, ancho: 700 },
    ]);
    expect(distribucionIdeal(1500, false)).toEqual([{ cantidad: 2, tipo: 'puertas', puertas: 2, ancho: 750 }]);
    for (const l of [400, 900, 1300, 2350, 3100]) {
      const r = distribucionIdeal(l, true);
      expect(r.reduce((s, m) => s + m.cantidad * m.ancho, 0)).toBeCloseTo(l, -1);
      for (const m of r) {
        if (m.tipo === 'cajonera') expect(m.ancho).toBeLessThanOrEqual(900);
        else expect(m.ancho / m.puertas).toBeLessThanOrEqual(450);
      }
    }
  });

  it('una puerta de 90 cm sugiere 2 puertas, con el cambio listo para aplicar', () => {
    const d = ejecutar(disenoLibre('cocina'), { op: 'fijarAncho', ancho: 2400 }).diseno;
    const items = recomendaciones(d, 'cm').flatMap((g) => g.items);
    const sug = items.find((i) => i.accion?.texto === 'Poner 2 puertas');
    expect(sug).toBeTruthy();
    const r = ejecutar(d, sug!.accion!.op);
    expect(r.ok).toBe(true);
    expect(recomendaciones(r.diseno, 'cm').flatMap((g) => g.items).some((i) => i.accion?.texto === 'Poner 2 puertas')).toBe(false);
  });

  it('avisa si el módulo del lavaplatos es más angosto que lo que pide el equipo', () => {
    let d = ejecutar(disenoLibre('cocina'), { op: 'fijarAncho', ancho: 2400 }).diseno;
    const lav = d.equipos.find((e) => e.tipo === 'lavaplatos')!;
    d = ejecutar(d, { op: 'configurarEquipo', id: lav.id, cambios: { modelo: 'pozo-doble' } }).diseno;
    const i = d.cuerpos.findIndex((c) => c.id === lav.modulo);
    d = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: lav.modulo, ancho: 700 }).diseno;
    const aviso = recomendaciones(d, 'cm').flatMap((g) => g.items).find((x) => x.texto.startsWith('El lavaplatos pide'));
    expect(aviso?.nivel).toBe('aviso');
    expect(aviso?.accion?.op).toMatchObject({ op: 'fijarAnchoModulo', ancho: 900 });
    expect(i).toBeGreaterThanOrEqual(0);
  });
});
