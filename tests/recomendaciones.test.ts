// Recomendaciones de puertas, cajones y módulos (sugerencias; todo sigue siendo editable).
import { describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import { cajonesIdeales, distribucionIdeal, puertasIdeales, recomendaciones } from '../shared/recomendaciones';
import { ejecutar } from '../shared/reglas';

describe('recomendaciones', () => {
  it('puertas entre 30 y 60 cm: 1 hasta 60, 2 en 70 a 120, 3 sobre eso', () => {
    expect([300, 450, 600, 700, 900, 1200, 1500].map(puertasIdeales)).toEqual([1, 1, 1, 2, 2, 2, 3]);
  });

  it('3 cajones en un mueble de cocina de 90 cm', () => {
    expect(cajonesIdeales(900 - 100 - 28)).toBe(3);
  });

  it('distribuye el largo libre: cajonera de 60 a 90 y módulos de 2 puertas', () => {
    expect(distribucionIdeal(900, true)).toEqual([{ cantidad: 1, tipo: 'cajonera', puertas: 0, ancho: 900 }]);
    expect(distribucionIdeal(1600, true)).toEqual([
      { cantidad: 1, tipo: 'cajonera', puertas: 0, ancho: 900 },
      { cantidad: 1, tipo: 'puertas', puertas: 2, ancho: 700 },
    ]);
    expect(distribucionIdeal(1500, false)).toEqual([{ cantidad: 2, tipo: 'puertas', puertas: 2, ancho: 750 }]);
    expect(distribucionIdeal(1800, false)).toEqual([
      { cantidad: 2, tipo: 'puertas', puertas: 2, ancho: 700 },
      { cantidad: 1, tipo: 'puertas', puertas: 1, ancho: 400 },
    ]);
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
