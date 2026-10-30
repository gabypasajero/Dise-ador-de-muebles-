// Aéreo solo en los lados de la L o la U, sin aéreo en el tramo principal.
import { describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import { aMundoAereoLado, calcularLayoutAereos, calcularLayoutAereosLado, extremosPrincipal } from '../shared/layout';
import { activarAereos, ejecutar, fijarAncho, fijarForma, largoTramo, normalizar, precioDiseno, tramosDe } from '../shared/reglas';
import { precioAereo } from '../shared/tarifas';
import type { Diseno } from '../shared/tipos';
import { validarDiseno } from '../shared/validar';

const enL = () => activarAereos(fijarForma(fijarAncho(disenoLibre('cocina'), 2100), 'L-der'), true);
const recargar = (d: Diseno) => normalizar(JSON.parse(JSON.stringify(d)));
const op = (d: Diseno, o: Parameters<typeof ejecutar>[1]) => {
  const r = ejecutar(d, o);
  expect(r.ok, r.motivo ?? undefined).toBe(true);
  return r.diseno;
};

describe('aéreo solo en los lados', () => {
  it('sin aéreo principal, el lado llega hasta el muro principal y se cobra solo el lado', () => {
    const d0 = enL();
    expect(tramosDe(d0)).toContain('aereos');
    const d = op(d0, { op: 'fijarAereoPrincipal', activo: false });
    expect(d.aereos.sinPrincipal).toBe(true);
    expect(d.aereos.cuerpos).toEqual([]);
    expect(tramosDe(d)).toEqual(['base', 'der', 'aereos-der']);
    expect(calcularLayoutAereos(d)).toBeNull();
    const r = d.aereos.lados.der!;
    // Los módulos llenan todo el largo, también la esquina.
    expect(largoTramo(d, 'aereos-der')).toBe(r.largo);
    expect(calcularLayoutAereosLado(d, 'der')).not.toBeNull();
    const [, x1] = extremosPrincipal(d);
    expect(aMundoAereoLado(d, 'der', -r.largo / 2, 0)).toEqual([x1, 0]);
    expect(precioAereo(d)!.lineas[0].detalle).toContain('solo en el lado derecho');
    expect(precioAereo(d)!.lineas[0].cantidad).toBeCloseTo(r.largo / 1000);
    expect(validarDiseno(d)).toEqual([]);
    expect(recargar(d)).toEqual(d);
    expect(precioDiseno(d, null, null)!.total).toBeLessThan(precioDiseno(d0, null, null)!.total);
  });

  it('se puede volver a poner el aéreo principal sin perder alto ni lados', () => {
    let d = op(enL(), { op: 'fijarAereos', alto: 700 });
    d = op(d, { op: 'fijarAereoPrincipal', activo: false });
    d = op(d, { op: 'fijarAereoPrincipal', activo: true });
    expect(d.aereos.sinPrincipal).toBeUndefined();
    expect(d.aereos.alto).toBe(700);
    expect(d.aereos.lados.der).not.toBeNull();
    expect(d.aereos.cuerpos.length).toBeGreaterThan(0);
    expect(largoTramo(d, 'aereos-der')).toBe(d.aereos.lados.der!.largo - d.aereos.profundidad);
    expect(validarDiseno(d)).toEqual([]);
  });

  it('en U puede quedar en los dos lados; volver a lineal repone el principal', () => {
    let d = activarAereos(fijarForma(fijarAncho(disenoLibre('cocina'), 2400), 'U'), true);
    d = op(d, { op: 'fijarAereoPrincipal', activo: false });
    expect(tramosDe(d)).toEqual(['base', 'izq', 'der', 'aereos-izq', 'aereos-der']);
    expect(validarDiseno(d)).toEqual([]);
    d = op(d, { op: 'fijarFormaAereos', forma: 'lineal' });
    expect(d.aereos.sinPrincipal).toBeUndefined();
    expect(tramosDe(d)).toContain('aereos');
    expect(validarDiseno(d)).toEqual([]);
  });

  it('sin lados no se puede quitar el principal', () => {
    const d = activarAereos(disenoLibre('cocina'), true);
    expect(ejecutar(d, { op: 'fijarAereoPrincipal', activo: false }).ok).toBe(false);
  });
});
