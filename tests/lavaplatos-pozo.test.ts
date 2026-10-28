// Lavaplatos de pozo (1 cubeta cuadrada honda) y de pozo doble, en acero oscuro, como en la tienda.
import { describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import { MEDIDAS_EQUIPO } from '../shared/layout';
import { ejecutar, normalizar, precioCocina, TARIFAS } from '../shared/reglas';
import { detalleCotizacion } from '../shared/resumen';
import { validarDiseno } from '../shared/validar';
import type { Lavaplatos } from '../shared/tipos';

function conModelo(modelo: Lavaplatos['modelo']) {
  const d = ejecutar(disenoLibre('cocina'), { op: 'fijarAncho', ancho: 2400 }).diseno;
  const lav = d.equipos.find((e): e is Lavaplatos => e.tipo === 'lavaplatos')!;
  const r = ejecutar(d, { op: 'configurarEquipo', id: lav.id, cambios: { modelo } });
  expect(r.ok, r.motivo ?? '').toBe(true);
  return r.diseno;
}

describe('lavaplatos de pozo', () => {
  it('se cobran 40.000 (pozo) y 70.000 (pozo doble), con su llave', () => {
    expect(TARIFAS.lavaplatos.pozo).toBe(40000);
    expect(TARIFAS.lavaplatos['pozo-doble']).toBe(70000);
    expect(precioCocina(conModelo('pozo')).lineas.find((l) => l.concepto === 'Lavaplatos de pozo')?.valor).toBe(40000);
    expect(precioCocina(conModelo('pozo-doble')).lineas.find((l) => l.concepto === 'Lavaplatos de pozo doble')?.valor).toBe(70000);
  });

  it('miden 55 y 82 cm de ancho total y se guardan y abren igual', () => {
    expect(MEDIDAS_EQUIPO.lavaplatos.pozo.anchoTotal).toBe(550);
    expect(MEDIDAS_EQUIPO.lavaplatos['pozo-doble'].anchoTotal).toBe(820);
    for (const m of ['pozo', 'pozo-doble'] as const) {
      const d = conModelo(m);
      expect(validarDiseno(d)).toEqual([]);
      expect(normalizar(JSON.parse(JSON.stringify(d)))).toEqual(d);
      expect(JSON.stringify(detalleCotizacion(d, null, 'cm', null))).toContain(m === 'pozo' ? 'de pozo' : 'de pozo doble');
    }
  });
});
