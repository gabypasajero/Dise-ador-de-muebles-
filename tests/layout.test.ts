import { describe, expect, it } from 'vitest';
import { cuerpo, disenoLibre } from '../shared/catalogo';
import { calcularLayout, calcularLayoutTocador, tramos } from '../shared/layout';
import type { Diseno } from '../shared/tipos';

function closet(parcial: Partial<Diseno> = {}): Diseno {
  return { ...disenoLibre('closet'), ...parcial };
}

describe('tramos', () => {
  it('reparte el largo dejando la luz entre piezas', () => {
    const t = tramos(0, 1003, 2, 3);
    expect(t).toEqual([
      [0, 500],
      [503, 1003],
    ]);
  });
});

describe('calcularLayout', () => {
  it('los módulos vecinos de un escritorio llevan su propio costado', () => {
    const d: Diseno = {
      ...disenoLibre('escritorio'),
      estructura: 'unica',
      separacionCuerpos: 0,
      ancho: 450 + 800 + 450,
      cuerpos: [cuerpo({ ancho: 450, puertas: 1 }), cuerpo({ tipo: 'escritorio', ancho: 800, alto: 750 }), cuerpo({ ancho: 450, cajones: 3 })],
    };
    const l = calcularLayout(d);
    expect(l.cuerpos[0].ladoDer).toBe(true);
    expect(l.cuerpos[2].ladoIzq).toBe(true);
  });


  it('dos puertas de un cuerpo de 80 cm miden lo mismo y respetan la luz', () => {
    const d = closet({ ancho: 800, alto: 1700, cuerpos: [cuerpo({ ancho: 800, puertas: 2, cajones: 0 })], luzFrentes: 3, zocalo: 60 });
    const l = calcularLayout(d);
    const puertas = l.frentes.filter((f) => f.tipo === 'puerta');
    expect(puertas).toHaveLength(2);
    const [a, b] = puertas.map((p) => p.rect);
    expect(a.x1 - a.x0).toBeCloseTo(b.x1 - b.x0);
    expect(b.x0 - a.x1).toBeCloseTo(3);
    expect(a.x0).toBeCloseTo(-400 + 1.5);
    expect(b.x1).toBeCloseTo(400 - 1.5);
    expect(puertas[0].bisagra).toBe('izq');
    expect(puertas[1].bisagra).toBe('der');
  });

  it('los cajones quedan abajo y las puertas encima', () => {
    const d = closet({ ancho: 800, cuerpos: [cuerpo({ ancho: 800, puertas: 2, cajones: 4, altoCajon: 180 })] });
    const l = calcularLayout(d);
    const cajones = l.frentes.filter((f) => f.tipo === 'cajon');
    const puertas = l.frentes.filter((f) => f.tipo === 'puerta');
    expect(cajones).toHaveLength(4);
    cajones.forEach((c) => expect(c.rect.y1 - c.rect.y0).toBeCloseTo(180));
    const topeCajones = Math.max(...cajones.map((c) => c.rect.y1));
    puertas.forEach((p) => expect(p.rect.y0).toBeGreaterThan(topeCajones));
  });

  it('la separación entre cuerpos desplaza los frentes', () => {
    const d = closet({
      ancho: 1220,
      separacionCuerpos: 20,
      cuerpos: [cuerpo({ ancho: 600, puertas: 1 }), cuerpo({ ancho: 600, puertas: 1 })],
    });
    const l = calcularLayout(d);
    expect(l.cuerpos[1].x0 - l.cuerpos[0].x1).toBe(20);
    expect(l.cuerpos.every((c) => c.ladoIzq && c.ladoDer)).toBe(true);
  });

  it('con estructura única dos cuerpos comparten una división', () => {
    const d = closet({ ancho: 1200, cuerpos: [cuerpo({ ancho: 600, puertas: 1 }), cuerpo({ ancho: 600, puertas: 1 })] });
    const l = calcularLayout(d);
    expect(l.divisiones).toHaveLength(1);
    expect(l.divisiones[0].x).toBe(0);
  });

  it('el horno de cocina deja una faja de melamina arriba', () => {
    const d = disenoLibre('cocina');
    const l = calcularLayout(d);
    const horno = l.cuerpos.find((c) => c.horno)!;
    expect(horno.horno!.y1 - horno.horno!.y0).toBeLessThanOrEqual(595);
    expect(l.frentes.some((f) => f.tipo === 'faja' && f.cuerpo === horno.indice)).toBe(true);
  });

  it('el espacio libre no lleva frentes', () => {
    const d = disenoLibre('cocina');
    d.cuerpos.push(cuerpo({ tipo: 'hueco', ancho: 600 }));
    d.ancho += 600;
    const l = calcularLayout(d);
    expect(l.frentes.filter((f) => f.cuerpo === d.cuerpos.length - 1)).toHaveLength(0);
  });

  it('la fila superior de la cómoda no se monta sobre los cajones de abajo', () => {
    const d = disenoLibre('comoda');
    d.filaSuperior = 3;
    const l = calcularLayout(d);
    const arriba = l.frentes.filter((f) => f.cuerpo === -1);
    const abajo = l.frentes.filter((f) => f.cuerpo >= 0);
    expect(arriba).toHaveLength(3);
    const minArriba = Math.min(...arriba.map((f) => f.rect.y0));
    abajo.forEach((f) => expect(f.rect.y1).toBeLessThan(minArriba));
  });
});

describe('calcularLayoutTocador', () => {
  it('ubica las cajoneras a los lados y el espejo sobre la cubierta', () => {
    const d = disenoLibre('tocador');
    d.tocador.cajonesIzq = 3;
    d.tocador.cajonesDer = 4;
    d.tocador.cajonesCentro = 2;
    const l = calcularLayoutTocador(d);
    expect(l.frentes).toHaveLength(9);
    expect(l.pedestales.map((p) => p.lado)).toEqual(['izq', 'der']);
    expect(l.espejo.y0).toBeGreaterThan(l.cubierta.y);
  });
});
