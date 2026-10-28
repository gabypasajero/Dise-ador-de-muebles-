// Mueble aéreo sobre el refrigerador: un cajón (o una puerta abatible) arriba y el refrigerador abajo.
import { describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import { ALTO_REFRIGERADOR, calcularLayoutAereos, inicioAereoPrincipal, extremosPrincipal } from '../shared/layout';
import { ANCHO_SOBRE_REFRIGERADOR, ejecutar, normalizar } from '../shared/reglas';
import { validarDiseno } from '../shared/validar';
import type { Diseno } from '../shared/tipos';

function conAereos(): Diseno {
  return ejecutar(disenoLibre('cocina'), { op: 'activarAereos', activo: true }).diseno;
}

function conRefri(d = conAereos()): Diseno {
  const r = ejecutar(d, { op: 'agregarModulo', tramo: 'aereos', preset: 'sobre-refrigerador' });
  expect(r.ok, r.motivo ?? '').toBe(true);
  return r.diseno;
}

describe('mueble sobre el refrigerador', () => {
  it('alarga el aéreo sin cambiar los otros módulos y queda al lado del mueble base', () => {
    const d = conAereos();
    const antes = d.aereos.cuerpos.map((c) => c.ancho);
    const r = conRefri(d);
    const cs = r.aereos.cuerpos;
    expect(cs.map((c) => c.ancho).slice(0, -1)).toEqual(antes);
    expect(cs[cs.length - 1]).toMatchObject({ tipo: 'refrigerador', ancho: ANCHO_SOBRE_REFRIGERADOR, cajones: 1, puertas: 0 });
    // Alineado a la izquierda: el aéreo parte con el base y se pasa por la derecha, sobre el refrigerador.
    const [x0, x1] = extremosPrincipal(r);
    expect(inicioAereoPrincipal(r)).toBe(x0);
    const la = calcularLayoutAereos(r)!;
    expect(la.cuerpos[la.cuerpos.length - 1].x0).toBe(x1);
    expect(validarDiseno(r)).toEqual([]);
  });

  it('el mueble va arriba (abajo queda el refrigerador) con un cajón o una puerta abatible', () => {
    const r = conRefri();
    const la = calcularLayoutAereos(r)!;
    const i = la.cuerpos.length - 1;
    const techo = r.aereos.elevacion + r.aereos.alto;
    expect(la.cuerpos[i].y1).toBe(techo);
    expect(la.cuerpos[i].y0).toBe(techo - Math.max(150, techo - ALTO_REFRIGERADOR));
    expect(la.frentes.filter((f) => f.cuerpo === i).map((f) => f.tipo)).toEqual(['cajon']);
    const id = r.aereos.cuerpos[i].id;
    const abatible = ejecutar(r, { op: 'actualizarModulo', tramo: 'aereos', modulo: id, cambios: { abatible: true } }).diseno;
    const fa = calcularLayoutAereos(abatible)!.frentes.filter((f) => f.cuerpo === i);
    expect(fa).toHaveLength(1);
    expect(fa[0].tipo === 'puerta' && fa[0].bisagra).toBe('arriba');
    // El alto se puede editar.
    const bajo = ejecutar(r, { op: 'actualizarModulo', tramo: 'aereos', modulo: id, cambios: { alto: 250 } }).diseno;
    const lb = calcularLayoutAereos(bajo)!.cuerpos[i];
    expect(lb.y1 - lb.y0).toBe(250);
    expect(normalizar(JSON.parse(JSON.stringify(bajo)))).toEqual(bajo);
  });

  it('al quitarlo el aéreo vuelve a su largo', () => {
    const d = conAereos();
    const r = conRefri(d);
    const id = r.aereos.cuerpos[r.aereos.cuerpos.length - 1].id;
    const sin = ejecutar(r, { op: 'quitarModulo', tramo: 'aereos', modulo: id }).diseno;
    expect(sin.aereos.cuerpos.map((c) => c.ancho)).toEqual(d.aereos.cuerpos.map((c) => c.ancho));
  });

  it('en L o U no hay lado libre: no se agrega, y si la cocina pasa a L se quita con aviso', () => {
    const enL = ejecutar(conAereos(), { op: 'fijarForma', forma: 'L-der' }).diseno;
    expect(ejecutar(enL, { op: 'agregarModulo', tramo: 'aereos', preset: 'sobre-refrigerador' }).ok).toBe(false);
    const r = ejecutar(conRefri(), { op: 'fijarForma', forma: 'L-der' });
    expect(r.ok).toBe(true);
    expect(r.diseno.aereos.cuerpos.some((c) => c.tipo === 'refrigerador')).toBe(false);
    expect(r.avisos.join(' ')).toContain('refrigerador');
    expect(validarDiseno(r.diseno)).toEqual([]);
  });
});
