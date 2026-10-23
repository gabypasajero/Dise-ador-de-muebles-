// Distancias entre equipos sobre la cubierta y encimera o lavaplatos «solo corte»
// (el cliente trae su equipo: la cubierta lleva solo el hueco y no se cobra).
import { describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import { distanciasEquipos, textoDistancia } from '../shared/equipos';
import { extremosPrincipal, largoEje, MEDIDAS_EQUIPO, ubicarEquipos } from '../shared/layout';
import { revisarOperacion } from '../shared/operaciones';
import { agregarEquipo, configurarEquipo, ejecutar, fijarForma, fijarLado, listarEquipamiento, normalizar } from '../shared/reglas';
import { fichaFabricacion, textoFicha, detalleCotizacion } from '../shared/resumen';
import { precioCocina, TARIFAS } from '../shared/tarifas';
import type { Diseno, Encimera, Lavaplatos } from '../shared/tipos';

const encimera = (d: Diseno) => d.equipos.find((e): e is Encimera => e.tipo === 'encimera')!;
const lavaplatos = (d: Diseno) => d.equipos.find((e): e is Lavaplatos => e.tipo === 'lavaplatos')!;

/** Cocina libre (1,5 m): horno con encimera de 4 platos y lavaplatos simple en el tramo principal. */
const cocina = (): Diseno => disenoLibre('cocina');
const sinEquipos = (): Diseno => ({ ...disenoLibre('cocina'), equipos: [] });
/** Largo libre + cortes de un tramo. */
const suma = (d: Diseno, t: 'base' | 'izq' | 'der') =>
  distanciasEquipos(d).filter((x) => x.tramo === t).reduce((s, x) => s + x.mm, 0) +
  ubicarEquipos(d).filter((u) => u.tramo === t && (u.tipo === 'encimera' || u.tipo === 'lavaplatos')).reduce((s, u) => s + u.ancho, 0);

describe('distancias entre equipos', () => {
  it('mide del borde al primer corte, entre cortes y del último corte al otro borde', () => {
    const d = cocina();
    const ds = distanciasEquipos(d).filter((x) => x.tramo === 'base');
    expect(ds).toHaveLength(3);
    expect(ds[0].desde).toBe('borde izquierdo');
    expect(ds[2].hasta).toBe('borde derecho');
    const ub = ubicarEquipos(d).filter((u) => u.tramo === 'base' && (u.tipo === 'encimera' || u.tipo === 'lavaplatos')).sort((a, b) => a.s - b.s);
    expect(ds[0].hasta).toBe(ub[0].tipo);
    expect(ds[1].desde).toBe(ub[0].tipo);
    expect(ds[1].hasta).toBe(ub[1].tipo);
    // Cada distancia usa el ancho real del corte.
    expect(ds[0].mm).toBe(Math.round(ub[0].s - ub[0].ancho / 2));
    expect(ds[1].mm).toBe(Math.round(ub[1].s - ub[1].ancho / 2 - (ub[0].s + ub[0].ancho / 2)));
    // Distancias + cortes = largo de la cubierta.
    expect(Math.abs(suma(d, 'base') - d.ancho)).toBeLessThanOrEqual(2);
    expect(MEDIDAS_EQUIPO.encimera['4'].ancho).toBe(580);
  });

  it('en texto: «Encimera ↔ lavaplatos: 42 cm»', () => {
    const x = { tramo: 'base' as const, desde: 'encimera', hasta: 'lavaplatos', desdeId: 'a', hastaId: 'b', s0: 0, s1: 420, mm: 420 };
    expect(textoDistancia(x)).toBe('Encimera ↔ lavaplatos: 42 cm');
    expect(textoDistancia({ ...x, desde: 'borde izquierdo', hasta: 'encimera', mm: 300 })).toBe('Borde izquierdo ↔ encimera: 30 cm');
    expect(textoDistancia({ ...x, mm: 425 }, 'mm')).toBe('Encimera ↔ lavaplatos: 425 mm');
  });

  it('sin equipos no hay distancias; los tramos sin cortes se omiten', () => {
    expect(distanciasEquipos(sinEquipos())).toEqual([]);
    expect(distanciasEquipos(disenoLibre('tocador'))).toEqual([]);
    const d = cocina();
    expect(new Set(distanciasEquipos(d).map((x) => x.tramo))).toEqual(new Set(['base']));
  });

  it('en la L el principal llega hasta el muro con la esquina y el lado va de la esquina a la punta', () => {
    let d = fijarForma(sinEquipos(), 'L-der');
    d = fijarLado(d, 'der', { largo: 1800 });
    d = agregarEquipo(d, 'encimera', { platos: '4', tramo: 'base' });
    d = agregarEquipo(d, 'lavaplatos', { modelo: 'simple', tramo: 'der' });
    const ds = distanciasEquipos(d);
    const [x0, x1] = extremosPrincipal(d);
    expect(ds.filter((x) => x.tramo === 'base').at(-1)!.hasta).toBe('borde derecho');
    expect(Math.abs(suma(d, 'base') - (x1 - x0))).toBeLessThanOrEqual(2);
    const lado = ds.filter((x) => x.tramo === 'der');
    expect(lado).toHaveLength(2);
    expect([lado[0].desde, lado[1].hasta].sort()).toEqual(['esquina', 'punta']);
    expect(Math.abs(suma(d, 'der') - largoEje(d, 'der'))).toBeLessThanOrEqual(2);
  });

  it('la ficha del maestro lista las distancias en el equipamiento', () => {
    const ficha = fichaFabricacion(cocina(), null, 'cm', null);
    const eq = ficha.secciones.find((s) => s.titulo === 'Equipamiento')!;
    expect(eq.lineas[0].etiqueta).toBe('Distancias · tramo principal');
    expect(eq.lineas[0].sub).toHaveLength(3);
    expect(textoFicha(ficha)).toMatch(/Borde izquierdo ↔ (encimera|lavaplatos): \d/);
  });
});

describe('solo corte', () => {
  it('normalizar deja soloCorte en false en los diseños antiguos y respeta el true', () => {
    const d = cocina();
    const viejo = JSON.parse(JSON.stringify(d));
    for (const e of viejo.equipos) delete e.soloCorte;
    expect(normalizar(viejo).equipos.every((e) => e.soloCorte === false)).toBe(true);
    const conCorte = JSON.parse(JSON.stringify(d));
    conCorte.equipos[0].soloCorte = true;
    expect(normalizar(conCorte).equipos[0].soloCorte).toBe(true);
    expect(cocina().equipos.every((e) => e.soloCorte === false)).toBe(true);
  });

  it('no cobra la encimera ni el lavaplatos ni su llave: solo el corte (TARIFAS.corte)', () => {
    let d = cocina();
    const antes = precioCocina(d).total;
    d = configurarEquipo(d, encimera(d).id, { soloCorte: true, campana: true });
    d = configurarEquipo(d, lavaplatos(d).id, { soloCorte: true });
    const p = precioCocina(d);
    expect(p.lineas.find((l) => l.concepto.startsWith('Encimera'))).toBeUndefined();
    expect(p.lineas.find((l) => l.concepto.startsWith('Lavaplatos'))).toBeUndefined();
    expect(p.lineas.find((l) => l.concepto === 'Llave')).toBeUndefined();
    const corteE = p.lineas.find((l) => l.concepto === 'Corte para encimera (sin equipo)')!;
    const corteL = p.lineas.find((l) => l.concepto === 'Corte para lavaplatos (sin equipo)')!;
    expect(corteE.valor).toBe(TARIFAS.corte);
    expect(corteL.valor).toBe(0);
    // La campana sobre una encimera solo corte se sigue cobrando.
    expect(p.lineas.find((l) => l.concepto === 'Campana')?.valor).toBe(TARIFAS.campana);
    expect(p.total).toBe(antes - TARIFAS.encimera['4'] - TARIFAS.lavaplatos.simple - TARIFAS.llave + TARIFAS.campana);
  });

  it('el lavaplatos solo corte queda sin llave y no acepta una', () => {
    let d = cocina();
    const id = lavaplatos(d).id;
    const r = ejecutar(d, { op: 'configurarEquipo', id, cambios: { soloCorte: true } });
    expect(r.ok).toBe(true);
    d = r.diseno;
    expect(lavaplatos(d).llave).toBe(false);
    expect(listarEquipamiento(d).some((i) => i.tipo === 'llave')).toBe(false);
    expect(ejecutar(d, { op: 'configurarEquipo', id, cambios: { llave: true } }).ok).toBe(false);
    expect(ejecutar(d, { op: 'agregarEquipo', equipo: 'llave', para: id }).ok).toBe(false);
    // Al volver a equipo completo, la llave se puede agregar otra vez.
    d = configurarEquipo(d, id, { soloCorte: false, llave: true });
    expect(lavaplatos(d)).toMatchObject({ soloCorte: false, llave: true });
  });

  it('agregarEquipo acepta soloCorte y el asistente lo puede pedir', () => {
    const op = { op: 'agregarEquipo', equipo: 'encimera', platos: '3', soloCorte: true } as const;
    expect(revisarOperacion(op)).toBeNull();
    expect(revisarOperacion({ op: 'configurarEquipo', id: 'e1', cambios: { soloCorte: false } })).toBeNull();
    expect(revisarOperacion({ op: 'configurarEquipo', id: 'e1', cambios: { soloCorte: 'si' } })).toMatch(/soloCorte/);
    const d = ejecutar(sinEquipos(), op).diseno;
    expect(encimera(d).soloCorte).toBe(true);
    const l = ejecutar(d, { op: 'agregarEquipo', equipo: 'lavaplatos', soloCorte: true }).diseno;
    expect(lavaplatos(l)).toMatchObject({ soloCorte: true, llave: false });
  });

  it('la cotización y la ficha lo describen con la medida del corte', () => {
    let d = cocina();
    d = configurarEquipo(d, encimera(d).id, { soloCorte: true });
    d = configurarEquipo(d, lavaplatos(d).id, { soloCorte: true });
    const ficha = textoFicha(fichaFabricacion(d, null, 'cm', null));
    expect(ficha).toContain('Encimera: solo corte de 58 × 51 cm (el cliente aporta el equipo)');
    expect(ficha).toContain('Lavaplatos: solo corte de 40 × 36 cm (el cliente aporta el equipo)');
    expect(ficha).toContain('encimera 4 platos (solo corte: el cliente aporta el equipo)');
    const detalle = detalleCotizacion(d, null, 'cm', null).map((l) => `${l.etiqueta}: ${l.valor}`).join('\n');
    expect(detalle).toContain('encimera: solo corte de 58 × 51 cm (el cliente aporta el equipo)');
    expect(detalle).toContain('lavaplatos: solo corte de 40 × 36 cm (el cliente aporta el equipo)');
  });
});
