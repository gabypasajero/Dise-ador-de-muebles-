// Isla: manda la cubierta (la base se ajusta a ella), se cobra por su largo, e isla lisa.
import { describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import { baseParaCubierta, largoIsla, mantenerCubierta, medidasIsla, mueblesProyecto, nuevoAdicional, precioAdicional, voladizoIsla, VUELO_SENTARSE } from '../shared/proyecto';
import { normalizar } from '../shared/reglas';
import type { Diseno, MuebleAdicional } from '../shared/tipos';

const conIsla = (cambios: Partial<MuebleAdicional> = {}): { p: Diseno; isla: MuebleAdicional } => {
  const p0 = disenoLibre('cocina');
  const isla = { ...nuevoAdicional(p0, 'isla'), ...cambios };
  return { p: { ...p0, adicionales: [isla] }, isla };
};

describe('medidas de la isla: manda la cubierta', () => {
  it('isla de trabajo: la cubierta sobresale 5 cm por los cuatro lados', () => {
    const { p, isla } = conIsla();
    const m = medidasIsla(p, isla);
    expect(m.cubierta.largo).toBe(m.base.largo + 100);
    expect(m.cubierta.fondo).toBe(m.base.fondo + 100);
  });

  it('cubierta de 180 × 80: la base queda de 170 × 70, y con asientos atrás de 30 cm, de 170 × 45', () => {
    const { p, isla } = conIsla();
    expect(baseParaCubierta(p, isla, { largo: 1800, fondo: 800 })).toEqual({ ancho: 1700, profundidad: 700 });
    const v = { ...voladizoIsla(isla), trasero: VUELO_SENTARSE };
    expect(baseParaCubierta(p, isla, { largo: 1800, fondo: 800 }, v)).toEqual({ ancho: 1700, profundidad: 450 });
  });

  it('con la cubierta fijada, al cambiar lo que sobresale se ajusta la base y la cubierta no cambia', () => {
    const { p, isla } = conIsla({ cubiertaFija: { largo: true, fondo: true } });
    const antes = medidasIsla(p, isla).cubierta;
    const isla2 = { ...isla, voladizo: { ...voladizoIsla(isla), trasero: 250 } };
    const p2 = mantenerCubierta({ ...p, adicionales: [isla2] }, isla.id, antes);
    const isla3 = p2.adicionales![0];
    expect(medidasIsla(p2, isla3).cubierta).toEqual(antes);
    expect(isla3.diseno.profundidad).toBe(isla.diseno.profundidad - 200);
  });

  it('la isla se cobra por el largo de su cubierta', () => {
    const { p, isla } = conIsla();
    const largo = largoIsla(p, isla);
    expect(largo).toBe(medidasIsla(p, isla).cubierta.largo);
    const precio = precioAdicional(isla, largo)!;
    expect(precio.lineas[0].cantidad).toBeCloseTo(largo / 1000);
    expect(precio.lineas[0].detalle).toContain('largo de cubierta');
    expect(precio.lineas.some((l) => l.concepto === 'Cubierta para sentarse')).toBe(false);
  });
});

describe('isla lisa', () => {
  it('se guarda y se dibuja con el frente cerrado', () => {
    const { p } = conIsla({ liso: true });
    const n = normalizar(JSON.parse(JSON.stringify(p)));
    expect(n.adicionales![0].liso).toBe(true);
    expect(mueblesProyecto(n).find((m) => m.tipo === 'isla')!.frenteLiso).toBe(true);
  });
});
