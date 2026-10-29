// Las medidas que el vendedor da a mano a cada módulo se conservan al editar los otros.
import { describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import { ejecutar, normalizar } from '../shared/reglas';
import { validarDiseno } from '../shared/validar';
import type { Diseno } from '../shared/tipos';

function cocina400(): Diseno {
  let d = disenoLibre('cocina');
  // Sin el horno (mide siempre 60 cm): todos los módulos se pueden ajustar.
  for (const c of d.cuerpos.filter((x) => x.tipo === 'horno')) d = ejecutar(d, { op: 'actualizarModulo', tramo: 'base', modulo: c.id, cambios: { tipo: 'frentes', puertas: 2 } }).diseno;
  d = ejecutar(d, { op: 'fijarAncho', ancho: 4000 }).diseno;
  d = ejecutar(d, { op: 'fijarForma', forma: 'L-izq' }).diseno;
  while (d.cuerpos.length < 4) d = ejecutar(d, { op: 'agregarModulo', tramo: 'base', preset: 'dos-puertas' }).diseno;
  return d;
}

describe('medidas de módulos dadas a mano', () => {
  it('al corregir el módulo 2 el módulo 1 conserva la medida que se le dio', () => {
    let d = cocina400();
    const [m1, m2] = d.cuerpos;
    const largo = d.cuerpos.reduce((s, c) => s + c.ancho, 0);
    d = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: m1.id, ancho: 900 }).diseno;
    expect(d.cuerpos[0].ancho).toBe(900);
    d = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: m2.id, ancho: 800 }).diseno;
    expect(d.cuerpos[0].ancho).toBe(900);
    expect(d.cuerpos[1].ancho).toBe(800);
    // Un tercero: los dos primeros siguen iguales.
    d = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: d.cuerpos[2].id, ancho: 700 }).diseno;
    expect(d.cuerpos.slice(0, 3).map((c) => c.ancho)).toEqual([900, 800, 700]);
    expect(d.cuerpos.reduce((s, c) => s + c.ancho, 0)).toBe(largo);
    expect(validarDiseno(d)).toEqual([]);
    // Se guarda así.
    expect(normalizar(JSON.parse(JSON.stringify(d))).cuerpos.map((c) => c.ancho)).toEqual(d.cuerpos.map((c) => c.ancho));
  });

  it('si los no fijados no alcanzan, ceden también los fijados', () => {
    let d = cocina400();
    const ids = d.cuerpos.map((c) => c.id);
    d = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: ids[0], ancho: 900 }).diseno;
    d = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: ids[1], ancho: 900 }).diseno;
    d = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: ids[2], ancho: 900 }).diseno;
    const r = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: ids[3], ancho: 2000 });
    expect(r.ok).toBe(true);
    expect(r.diseno.cuerpos[3].ancho).toBe(2000);
    expect(validarDiseno(r.diseno)).toEqual([]);
  });
});

describe('los cajones toman primero la diferencia', () => {
  it('al agrandar un módulo de puertas se achica la cajonera, no las otras puertas', () => {
    let d = cocina400();
    // Módulo 2 de cajones; los demás de puertas.
    d = ejecutar(d, { op: 'actualizarModulo', tramo: 'base', modulo: d.cuerpos[1].id, cambios: { puertas: 0, cajones: 3 } }).diseno;
    const antes = d.cuerpos.map((c) => c.ancho);
    d = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: d.cuerpos[0].id, ancho: antes[0] + 100 }).diseno;
    expect(d.cuerpos[1].ancho).toBe(antes[1] - 100);
    expect(d.cuerpos[2].ancho).toBe(antes[2]);
    expect(d.cuerpos[3].ancho).toBe(antes[3]);
  });
});

describe('las medidas fijadas se conservan al cambiar el mueble', () => {
  it('al cambiar el ancho total o agregar un módulo, los fijados no se mueven', () => {
    let d = cocina400();
    const ids = d.cuerpos.map((c) => c.id);
    d = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: ids[0], ancho: 900 }).diseno;
    d = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: ids[1], ancho: 800 }).diseno;
    const fijo = (x: Diseno) => [x.cuerpos.find((c) => c.id === ids[0])!.ancho, x.cuerpos.find((c) => c.id === ids[1])!.ancho];
    const mas = ejecutar(d, { op: 'fijarAncho', ancho: 4500 }).diseno;
    expect(fijo(mas)).toEqual([900, 800]);
    const menos = ejecutar(d, { op: 'fijarAncho', ancho: 3600 }).diseno;
    expect(fijo(menos)).toEqual([900, 800]);
    const otro = ejecutar(d, { op: 'agregarModulo', tramo: 'base', preset: 'puerta' }).diseno;
    expect(fijo(otro)).toEqual([900, 800]);
    expect(validarDiseno(mas)).toEqual([]);
  });
});
