// Isla: medidas de la base y de la cubierta por separado, e isla lisa (sin puertas ni cajones).
import { describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import { medidasIsla, mueblesProyecto, nuevoAdicional, precioAdicional, voladizoParaCubierta } from '../shared/proyecto';
import { normalizar } from '../shared/reglas';
import type { Diseno, MuebleAdicional } from '../shared/tipos';

const conIsla = (cambios: Partial<MuebleAdicional> = {}): { p: Diseno; isla: MuebleAdicional } => {
  const p0 = disenoLibre('cocina');
  const isla = { ...nuevoAdicional(p0, 'isla'), ...cambios };
  return { p: { ...p0, adicionales: [isla] }, isla };
};

describe('medidas de la isla', () => {
  it('la cubierta se pide con su medida y la base no cambia', () => {
    const { p, isla } = conIsla();
    const antes = medidasIsla(p, isla);
    const v = voladizoParaCubierta(p, isla, { largo: antes.base.largo + 600, fondo: antes.base.fondo + 400 });
    const isla2 = { ...isla, voladizo: v };
    const p2 = { ...p, adicionales: [isla2] };
    const m = medidasIsla(p2, isla2);
    expect(m.base).toEqual(antes.base);
    expect(m.cubierta.largo).toBe(antes.base.largo + 600);
    expect(m.cubierta.fondo).toBe(antes.base.fondo + 400);
    expect(v.izq).toBe(300);
    expect(v.der).toBe(300);
  });

  it('al cambiar la base, el voladizo se recalcula para conservar la cubierta', () => {
    const { p, isla } = conIsla({ voladizo: { frente: 0, trasero: 300, izq: 200, der: 200 } });
    const cub = medidasIsla(p, isla).cubierta;
    const isla2 = { ...isla, diseno: { ...isla.diseno, ancho: isla.diseno.ancho - 200 } };
    const p2 = { ...p, adicionales: [isla2] };
    const isla3 = { ...isla2, voladizo: voladizoParaCubierta(p2, isla2, { largo: cub.largo }) };
    expect(medidasIsla({ ...p, adicionales: [isla3] }, isla3).cubierta.largo).toBe(cub.largo);
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

describe('cubierta para sentarse en el desglose', () => {
  it('va en $0 y el vendedor escribe su valor', () => {
    const { isla } = conIsla({ voladizo: { frente: 0, trasero: 300, izq: 0, der: 0 } });
    const p0 = precioAdicional(isla)!;
    const linea = p0.lineas.find((l) => l.concepto === 'Cubierta para sentarse')!;
    expect(linea.valor).toBe(0);
    const conValor = precioAdicional({ ...isla, diseno: { ...isla.diseno, ajustesPrecio: { valores: { [linea.clave]: 90000 }, extras: [] } } })!;
    expect(conValor.total).toBe(p0.total + 90000);
    expect(precioAdicional(conIsla().isla)!.lineas.some((l) => l.concepto === 'Cubierta para sentarse')).toBe(false);
  });
});
