// Proyecto con varios muebles: el principal más islas y muebles en línea, todo en una cotización.
import { describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import { dimensionesTotales, extremosPrincipal } from '../shared/layout';
import { ISLA_ESTANDAR, PASILLO_ISLA, mueblesProyecto, nuevoAdicional, precioAdicional, precioProyecto } from '../shared/proyecto';
import { ejecutar, normalizar, precioCocina, TARIFAS } from '../shared/reglas';
import { validarDiseno } from '../shared/validar';
import type { Diseno } from '../shared/tipos';

function conAdicionales(): Diseno {
  const p = disenoLibre('cocina');
  const isla = nuevoAdicional(p, 'isla');
  const linea = nuevoAdicional({ ...p, adicionales: [isla] }, 'linea');
  return { ...p, adicionales: [isla, linea] };
}

describe('proyecto con varios muebles', () => {
  it('la isla parte en 150 × 90 × 90, sin equipos ni aéreos, al frente del principal con un pasillo', () => {
    const p = disenoLibre('cocina');
    const a = nuevoAdicional(p, 'isla');
    expect(a.tipo).toBe('isla');
    expect(a.nombre).toBe('Isla');
    expect({ ancho: a.diseno.ancho, alto: a.diseno.alto, profundidad: a.diseno.profundidad }).toEqual(ISLA_ESTANDAR);
    expect(a.diseno.equipos).toEqual([]);
    expect(a.diseno.aereos.activo).toBe(false);
    expect(a.diseno.cocina.copete).toBe(false);
    expect(a.diseno.materiales).toEqual(p.materiales);
    // (x, z) es el centro de la isla en la planta: su respaldo queda a un pasillo del principal.
    expect(a.z - a.diseno.profundidad / 2).toBe(dimensionesTotales(p).fondo + PASILLO_ISLA);
    expect(validarDiseno(a.diseno)).toEqual([]);
  });

  it('el mueble en línea va a la derecha del principal, contra el mismo muro', () => {
    const p = disenoLibre('cocina');
    const a = nuevoAdicional(p, 'linea');
    const [, x1] = extremosPrincipal(p);
    expect(a.z).toBe(a.diseno.profundidad / 2);
    expect(a.x - a.diseno.ancho / 2).toBe(x1);
    expect(a.diseno.profundidad).toBe(p.profundidad);
    // El segundo va después del primero.
    const b = nuevoAdicional({ ...p, adicionales: [a] }, 'linea');
    expect(b.nombre).toBe('Mueble en línea 2');
    expect(b.x - b.diseno.ancho / 2).toBe(a.x + a.diseno.ancho / 2);
  });

  it('la isla se cobra a $170.000 por metro lineal, más sus equipos', () => {
    const p = disenoLibre('cocina');
    const a = nuevoAdicional(p, 'isla');
    const precio = precioAdicional(a)!;
    expect(precio.lineas[0]).toMatchObject({ concepto: 'Isla', cantidad: 1.5, unitario: TARIFAS.isla, valor: 1.5 * 170000 });
    expect(precio.lineas.some((l) => l.concepto.startsWith('Mueble base'))).toBe(false);
    const conLavaplatos = { ...a, diseno: ejecutar(a.diseno, { op: 'agregarEquipo', equipo: 'lavaplatos' }).diseno };
    expect(precioAdicional(conLavaplatos)!.total).toBe(1.5 * 170000 + TARIFAS.lavaplatos.simple + TARIFAS.llave);
  });

  it('el total del proyecto suma todos los muebles y cada uno conserva sus correcciones', () => {
    const p = conAdicionales();
    const r = precioProyecto(p, null, null);
    expect(r.partes.map((x) => x.nombre)).toEqual(['Mueble principal', 'Isla', 'Mueble en línea']);
    const { adicionales: _a, ...principal } = p;
    expect(r.partes[0].precio!.total).toBe(precioCocina(principal).total);
    expect(r.partes[2].precio!.total).toBe(precioCocina(p.adicionales![1].diseno).total);
    expect(r.total).toBe(r.partes.reduce((s, x) => s + x.precio!.total, 0));
    const ajustada = { ...p.adicionales![0], diseno: { ...p.adicionales![0].diseno, ajustesPrecio: { valores: {}, extras: [{ id: 'x', concepto: 'Descuento', valor: -10000 }] } } };
    const r2 = precioProyecto({ ...p, adicionales: [ajustada, p.adicionales![1]] }, null, null);
    expect(r2.total).toBe(r.total - 10000);
  });

  it('se guarda y se abre igual, y las operaciones del principal conservan los adicionales', () => {
    const p = conAdicionales();
    const n = normalizar(JSON.parse(JSON.stringify(p)));
    expect(n.adicionales).toEqual(p.adicionales);
    expect(normalizar(JSON.parse(JSON.stringify(n)))).toEqual(n);
    const ancho = ejecutar(n, { op: 'fijarAncho', ancho: 2400 }).diseno;
    expect(ancho.adicionales).toEqual(p.adicionales);
    expect(mueblesProyecto(ancho).map((m) => m.tipo)).toEqual(['principal', 'isla', 'linea']);
  });

  it('un adicional dañado al abrir se corrige o se descarta', () => {
    const p = disenoLibre('cocina');
    const n = normalizar({ ...p, adicionales: [null, { tipo: 'isla' }, { tipo: 'raro', giro: 450, x: 'a', diseno: { plantilla: 'closet' } }] } as unknown as Diseno);
    expect(n.adicionales).toHaveLength(1);
    expect(n.adicionales![0]).toMatchObject({ tipo: 'linea', giro: 90, x: 0, nombre: 'Mueble en línea' });
    expect(n.adicionales![0].diseno.plantilla).toBe('cocina');
    expect(normalizar(p).adicionales).toBeUndefined();
  });
});

describe('isla con caras (lado trasero y costados)', () => {
  const conIsla = () => {
    const p = disenoLibre('cocina');
    const isla = nuevoAdicional(p, 'isla');
    return { p: { ...p, adicionales: [isla] }, isla };
  };

  it('el lado trasero parte el fondo en dos, espalda con espalda, y sin él vuelve entero', async () => {
    const { agregarCara, quitarCara, mueblesProyecto } = await import('../shared/proyecto');
    const { p, isla } = conIsla();
    const t = agregarCara(p, isla.id, 'trasera');
    const frente = t.adicionales!.find((a) => a.id === isla.id)!;
    const trasera = t.adicionales!.find((a) => a.cara === 'trasera')!;
    expect(frente.diseno.profundidad).toBe(450);
    expect(trasera.diseno).toMatchObject({ ancho: 1500, profundidad: 450, alto: 900 });
    const m = mueblesProyecto(t);
    const mf = m.find((x) => x.id === isla.id)!;
    const mt = m.find((x) => x.id === trasera.id)!;
    // Espalda con espalda: centros a 450 mm, mirando a lados opuestos, y sin respaldo a la vista.
    expect(mf.z - mt.z).toBe(450);
    expect(mf.z + mt.z).toBe(2 * isla.z);
    expect([mf.giro, mt.giro]).toEqual([0, 180]);
    expect(mf.respaldo).toBe(false);
    const sin = quitarCara(t, trasera.id);
    expect(sin.adicionales!.find((a) => a.id === isla.id)!.diseno.profundidad).toBe(900);
    expect(sin.adicionales).toHaveLength(1);
  });

  it('los costados miden el fondo total, van en las puntas y la isla se cobra con su largo', async () => {
    const { agregarCara, mueblesProyecto, precioProyecto } = await import('../shared/proyecto');
    const { p, isla } = conIsla();
    let t = agregarCara(p, isla.id, 'trasera');
    t = agregarCara(t, isla.id, 'der');
    t = agregarCara(t, isla.id, 'izq');
    const der = t.adicionales!.find((a) => a.cara === 'der')!;
    expect(der.diseno.ancho).toBe(900);
    const m = mueblesProyecto(t);
    const md = m.find((x) => x.id === der.id)!;
    expect(md.x - isla.x).toBe(750 + 225);
    expect(md.giro).toBe(90);
    expect(m.find((x) => x.cara === 'izq')!.giro).toBe(270);
    const r = precioProyecto(t, null, null);
    const pi = r.partes.find((x) => x.id === isla.id)!.precio!;
    expect(pi.lineas[0]).toMatchObject({ concepto: 'Isla', cantidad: 2.4 });
    // Las caras no vuelven a cobrar el metro de la isla.
    expect(r.partes.find((x) => x.id === der.id)!.precio!.total).toBe(0);
  });

  it('las caras siguen las medidas de la isla, se guardan y se descartan sin su isla', async () => {
    const { agregarCara, acomodarCaras } = await import('../shared/proyecto');
    const { p, isla } = conIsla();
    let t = agregarCara(agregarCara(p, isla.id, 'trasera'), isla.id, 'der');
    t = { ...t, adicionales: t.adicionales!.map((a) => (a.id === isla.id ? { ...a, diseno: ejecutar(a.diseno, { op: 'fijarAncho', ancho: 2000 }).diseno } : a)) };
    t = acomodarCaras(t);
    expect(t.adicionales!.find((a) => a.cara === 'trasera')!.diseno.ancho).toBe(2000);
    const n = normalizar(JSON.parse(JSON.stringify(t)));
    expect(n.adicionales).toEqual(t.adicionales);
    const huerfanas = normalizar({ ...t, adicionales: t.adicionales!.filter((a) => a.id !== isla.id) });
    expect(huerfanas.adicionales).toBeUndefined();
  });
});
