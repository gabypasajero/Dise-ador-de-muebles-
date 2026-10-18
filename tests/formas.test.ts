// Formas del mueble base y de los aéreos: lineal, L izquierda, L derecha y U.
import { describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import {
  aMundoAereoLado,
  aMundoLado,
  calcularLayout,
  calcularLayoutAereos,
  calcularLayoutAereosLado,
  dimensionesTotales,
  disenoLado,
  extremosPrincipal,
  posEnMundo,
  posEnTramo,
  retornoDe,
  transformAereoLado,
  transformLado,
} from '../shared/layout';
import {
  activarAereos,
  actualizarCuerpo,
  agregarModulo,
  cuerposDe,
  ejecutar,
  fijarAereosCuadrados,
  fijarAncho,
  fijarAnchoCuerpo,
  fijarForma,
  fijarFormaAereos,
  fijarLado,
  fijarLadoAereo,
  formaAereos,
  formaBase,
  largoTramo,
  moverCuerpo,
  normalizar,
  presetsModulo,
  quitarCuerpo,
  tramosDe,
} from '../shared/reglas';
import { validarDiseno } from '../shared/validar';
import type { Diseno, TramoId } from '../shared/tipos';

const u = () => fijarForma(fijarAncho(disenoLibre('cocina'), 2400), 'U');
const recargar = (d: Diseno) => normalizar(JSON.parse(JSON.stringify(d)));

describe('mueble base en U', () => {
  it('tiene un lado a cada costado contra su muro lateral', () => {
    const d = u();
    expect(formaBase(d)).toBe('U');
    expect(tramosDe(d)).toEqual(['base', 'izq', 'der']);
    const [x0, x1] = extremosPrincipal(d);
    expect([x0, x1]).toEqual([-1200 - 600, 1200 + 600]);
    expect(dimensionesTotales(d)).toMatchObject({ x0, x1, fondo: 1200 });
    expect(transformLado(d, 'izq')).toMatchObject({ x: x0, rotY: Math.PI / 2 });
    expect(transformLado(d, 'der')).toMatchObject({ x: x1, rotY: -Math.PI / 2 });
    // El lado derecho parte en la esquina (z = fondo del principal) y llega a su largo.
    const util = d.lados.der!.largo - d.profundidad;
    expect(aMundoLado(d, 'der', -util / 2, 0)).toEqual([x1, d.profundidad]);
    expect(aMundoLado(d, 'der', util / 2, 0)).toEqual([x1, d.lados.der!.largo]);
    // En el izquierdo el módulo 1 queda en la punta abierta.
    expect(aMundoLado(d, 'izq', -util / 2, 0)).toEqual([x0, d.lados.izq!.largo]);
    expect(validarDiseno(d)).toEqual([]);
    expect(recargar(d)).toEqual(d);
  });

  it('el eje de cada tramo va y vuelve del mundo', () => {
    const d = activarAereos(u(), true);
    for (const t of tramosDe(d)) {
      for (const s of [0, 137, 400]) {
        expect(posEnTramo(d, t, posEnMundo(d, t, s)), `${t} ${s}`).toBeCloseTo(s);
      }
    }
  });

  it('cada lado es tan editable como el principal', () => {
    let d = u();
    for (const lado of ['izq', 'der'] as const) {
      d = fijarLado(d, lado, { largo: 1800, profundidad: 550 });
      expect(d.lados[lado]).toMatchObject({ largo: 1800, profundidad: 550 });
      d = agregarModulo(d, presetsModulo('cocina', lado).find((p) => p.id === 'cajonera')!, 0, lado);
      d = agregarModulo(d, presetsModulo('cocina', lado).find((p) => p.id === 'puerta')!, 1, lado);
      d = actualizarCuerpo(d, 1, { puertas: 1, bisagra: 'izq', cajones: 1, cajonesArriba: true }, lado);
      d = fijarAnchoCuerpo(d, 0, 400, lado);
      d = moverCuerpo(d, 0, 1, lado);
      expect(largoTramo(d, lado)).toBe(1800 - d.profundidad);
      d = quitarCuerpo(d, 0, lado);
      expect(largoTramo(d, lado)).toBe(1800 - d.profundidad);
      const frentes = calcularLayout(disenoLado(d, lado)!).frentes;
      expect(frentes.length).toBeGreaterThan(0);
      expect(validarDiseno(d), lado).toEqual([]);
    }
  });

  it('pasar de L izquierda a L derecha lleva el lado con sus módulos y su equipamiento', () => {
    let d = fijarForma(fijarAncho(disenoLibre('cocina'), 2400), 'izq');
    d = fijarLado(d, 'izq', { largo: 1600 });
    d = ejecutar(d, { op: 'agregarEquipo', equipo: 'lavaplatos', tramo: 'izq' }).diseno;
    const lav = d.equipos.find((e) => e.tramo === 'izq')!;
    const ids = d.lados.izq!.cuerpos.map((c) => c.id);
    const der = fijarForma(d, 'L-der');
    expect(der.lados.izq).toBeNull();
    expect(der.lados.der!.cuerpos.map((c) => c.id)).toEqual(ids);
    expect(der.lados.der!.largo).toBe(1600);
    expect(der.equipos.find((e) => e.id === lav.id)!.tramo).toBe('der');
    expect(retornoDe(der)!.lado).toBe('der');
    expect(validarDiseno(der)).toEqual([]);
  });

  it('al quitar un lado su equipamiento pasa al tramo principal', () => {
    let d = u();
    d = ejecutar(d, { op: 'agregarEquipo', equipo: 'lavaplatos', tramo: 'der', modulo: 0 }).diseno;
    const r = ejecutar(d, { op: 'fijarForma', forma: 'L-izq' });
    expect(r.diseno.lados.der).toBeNull();
    expect(r.diseno.equipos.filter((e) => e.tipo === 'lavaplatos').every((e) => e.tramo === 'base')).toBe(true);
    expect(r.avisos.join(' ')).toMatch(/Se quitó el lado derecho/);
    expect(validarDiseno(r.diseno)).toEqual([]);
  });
});

describe('aéreos en L y U', () => {
  it('por defecto quedan cuadrados con el base: misma forma y medidas de cada lado', () => {
    const d = activarAereos(u(), true);
    expect(d.aereos.cuadrado).toBe(true);
    expect(formaAereos(d)).toBe('U');
    const [x0, x1] = extremosPrincipal(d);
    expect(largoTramo(d, 'aereos')).toBe(x1 - x0);
    expect(d.aereos.lados.izq!.largo).toBe(d.lados.izq!.largo);
    expect(d.aereos.lados.der!.largo).toBe(d.lados.der!.largo);
    expect(tramosDe(d)).toEqual(['base', 'izq', 'der', 'aereos', 'aereos-izq', 'aereos-der']);
    // Cada lado del aéreo cuelga del mismo muro que el lado del base, desde la esquina del aéreo.
    expect(transformAereoLado(d, 'der')!.x).toBe(x1);
    const util = d.aereos.lados.der!.largo - d.aereos.profundidad;
    expect(aMundoAereoLado(d, 'der', -util / 2, 0)).toEqual([x1, d.aereos.profundidad]);
    const ll = calcularLayoutAereosLado(d, 'der')!;
    expect(ll.x1 - ll.x0).toBe(util);
    expect(ll.y0).toBe(d.aereos.elevacion);
    expect(validarDiseno(d)).toEqual([]);
  });

  it('siguen al base cuando cambia su forma o sus medidas', () => {
    let d = activarAereos(fijarAncho(disenoLibre('cocina'), 2400), true);
    d = fijarForma(d, 'L-der');
    expect(formaAereos(d)).toBe('L-der');
    d = fijarLado(d, 'der', { largo: 2000 });
    expect(d.aereos.lados.der!.largo).toBe(2000);
    d = fijarAncho(d, 3000);
    const [x0, x1] = extremosPrincipal(d);
    expect(largoTramo(d, 'aereos')).toBe(x1 - x0);
    d = fijarForma(d, 'U');
    expect(formaAereos(d)).toBe('U');
    d = fijarForma(d, 'lineal');
    expect(formaAereos(d)).toBe('lineal');
    expect(largoTramo(d, 'aereos')).toBe(d.ancho);
    expect(validarDiseno(d)).toEqual([]);
  });

  it('se pueden cambiar a pedido del cliente y volver a cuadrarlos', () => {
    let d = activarAereos(u(), true);
    d = fijarFormaAereos(d, 'L-izq');
    expect(d.aereos.cuadrado).toBe(false);
    expect(formaAereos(d)).toBe('L-izq');
    expect(calcularLayoutAereos(d)!.x0).toBe(extremosPrincipal(d)[0]);
    d = fijarLadoAereo(d, 'izq', { largo: 900, profundidad: 350 });
    expect(d.aereos.lados.izq).toMatchObject({ largo: 900, profundidad: 350 });
    // El base cambia y los aéreos ya no lo siguen.
    d = fijarLado(d, 'izq', { largo: 2000 });
    expect(d.aereos.lados.izq!.largo).toBe(900);
    expect(validarDiseno(d)).toEqual([]);
    d = fijarAereosCuadrados(d, true);
    expect(formaAereos(d)).toBe('U');
    expect(d.aereos.lados.izq!.largo).toBe(2000);
    expect(validarDiseno(d)).toEqual([]);
    expect(recargar(d)).toEqual(d);
  });

  it('un aéreo en L sobre un base lineal se ancla al muro de ese lado', () => {
    let d = activarAereos(fijarAncho(disenoLibre('cocina'), 2400), true);
    d = fijarFormaAereos(d, 'L-der');
    const la = calcularLayoutAereos(d)!;
    expect(la.x1).toBe(d.ancho / 2);
    expect(transformAereoLado(d, 'der')!.x).toBe(d.ancho / 2);
    expect(validarDiseno(d)).toEqual([]);
  });

  it('los módulos de cada lado del aéreo se editan igual que los del principal', () => {
    let d = activarAereos(u(), true);
    for (const t of ['aereos-izq', 'aereos-der'] as TramoId[]) {
      const largo = largoTramo(d, t);
      d = agregarModulo(d, presetsModulo('cocina', t).find((p) => p.id === 'abatible')!, 0, t);
      d = actualizarCuerpo(d, 1, { puertas: 1, bisagra: 'izq' }, t);
      d = moverCuerpo(d, 0, 1, t);
      expect(largoTramo(d, t)).toBe(largo);
      d = quitarCuerpo(d, 1, t);
      expect(largoTramo(d, t)).toBe(largo);
      expect(cuerposDe(d, t).length).toBeGreaterThan(0);
    }
    expect(validarDiseno(d)).toEqual([]);
  });
});
