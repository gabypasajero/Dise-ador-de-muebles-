// Correcciones del vendedor al desglose del precio.
import { describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import { aplicarAjustes, clavesLineas, limpiarAjustes, normalizar, normalizarAjustes, precioDiseno } from '../shared/reglas';
import type { LineaPrecio } from '../shared/tarifas';

const l = (concepto: string, valor: number, detalle = ''): LineaPrecio => ({ concepto, detalle, cantidad: 1, unidad: 'unidad', unitario: valor, valor });
const precio = { total: 300000, metodo: 'oficial' as const, lineas: [l('Base', 200000, '2 m'), l('Encimera', 100000)] };

describe('aplicarAjustes', () => {
  it('sin ajustes deja el precio igual', () => {
    const p = aplicarAjustes(precio, undefined)!;
    expect(p.total).toBe(300000);
    expect(p.ajustado).toBe(false);
    expect(p.lineas.map((x) => x.clave)).toEqual(['Base|2 m', 'Encimera|']);
  });
  it('suma los valores editados y los ajustes libres', () => {
    const p = aplicarAjustes(precio, { valores: { 'Encimera|': 120000, 'Ya no existe|': 5 }, extras: [{ id: 'a', concepto: 'Descuento', valor: -20000 }] })!;
    expect(p.total).toBe(300000);
    expect(p.lineas[1]).toMatchObject({ valor: 120000, calculado: 100000, editado: true });
    expect(p.lineas[0].editado).toBe(false);
    expect(p.totalCalculado).toBe(300000);
    expect(p.ajustado).toBe(true);
  });
  it('nunca da un total negativo y acepta null', () => {
    expect(aplicarAjustes(precio, { valores: {}, extras: [{ id: 'x', concepto: 'x', valor: -1e9 }] })!.total).toBe(0);
    expect(aplicarAjustes(null, undefined)).toBeNull();
  });
  it('las líneas repetidas tienen claves distintas', () => {
    expect(clavesLineas([l('A', 1), l('A', 1)])).toEqual(['A|', 'A|#2']);
  });
  it('limpiarAjustes quita líneas que desaparecieron', () => {
    expect(limpiarAjustes({ valores: { 'Nada|': 1 }, extras: [] }, precio.lineas)).toBeUndefined();
    expect(limpiarAjustes({ valores: { 'Base|2 m': 1, 'Nada|': 1 }, extras: [] }, precio.lineas)).toEqual({ valores: { 'Base|2 m': 1 }, extras: [] });
  });
  it('funciona con el precio real de una cocina', () => {
    const d = disenoLibre('cocina');
    const base = precioDiseno(d, null, null)!;
    const clave = clavesLineas(base.lineas)[0];
    const p = aplicarAjustes(base, { valores: { [clave]: base.lineas[0].valor + 1000 }, extras: [] })!;
    expect(p.total).toBe(base.total + 1000);
  });
});

describe('normalizar ajustesPrecio', () => {
  it('acepta diseños antiguos sin ajustes', () => {
    const d = normalizar(disenoLibre('cocina'));
    expect(d.ajustesPrecio).toBeUndefined();
  });
  it('conserva ajustes válidos y descarta basura', () => {
    const d = normalizar({ ...disenoLibre('cocina'), ajustesPrecio: { valores: { a: 10.4, b: 'x' as unknown as number }, extras: [{ id: 'e', concepto: 'Desc', valor: -5 }, { valor: 'no' } as never] } });
    expect(d.ajustesPrecio).toEqual({ valores: { a: 10 }, extras: [{ id: 'e', concepto: 'Desc', valor: -5 }] });
    expect(normalizarAjustes({ valores: {}, extras: [] })).toBeUndefined();
    expect(normalizarAjustes('x')).toBeUndefined();
  });
});

describe('formatoPrecio', () => {
  it('muestra los negativos con signo menos antes del $', async () => {
    const { formatoPrecio } = await import('../shared/reglas');
    expect(formatoPrecio(-30000)).toBe('−$30.000');
    expect(formatoPrecio(30000)).toBe('$30.000');
    expect(formatoPrecio(-0.4)).toBe('$0');
  });
});
