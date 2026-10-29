// Secuencias aleatorias de operaciones (como las haría un cliente indeciso o el asistente):
// después de cada una el diseño debe seguir siendo válido, estable al guardarlo y abrirlo,
// un rechazo no debe cambiar nada y agregar o quitar módulos no cambia el largo: lo absorben parejo
// los módulos que se ajustan (en las cocinas, las cajoneras y los abatibles).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial, disenoLibre } from '../shared/catalogo';
import { calcularLayout, calcularLayoutAereos, calcularLayoutAereosLado, disenoLado, ubicarEquipos } from '../shared/layout';
import {
  absorbe,
  cuerposDe,
  ejecutar,
  largoTramo,
  limitesReparto,
  listarEquipamiento,
  normalizar,
  precioDiseno,
  presetsModulo,
  resolverTramo,
  tiposPermitidos,
  tramosDe,
  type Operacion,
} from '../shared/reglas';
import { detalleCotizacion, fichaFabricacion } from '../shared/resumen';
import { validarDiseno } from '../shared/validar';
import type { Cuerpo, Diseno, Forma, ProductoTienda, Tramo, TramoBase } from '../shared/tipos';

/** Generador pseudoaleatorio con semilla (mulberry32): las fallas se pueden repetir. */
function azar(semilla: number) {
  let a = semilla >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entero = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));
  const uno = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  return { r, entero, uno };
}

const FORMAS: Forma[] = ['lineal', 'L-izq', 'L-der', 'U'];

function operacionAzar(d: Diseno, z: ReturnType<typeof azar>): Operacion {
  const tramos = tramosDe(d);
  const t = z.uno(tramos);
  const n = cuerposDe(d, t).length;
  const modulo = n ? z.entero(0, n - 1) : 0;
  const tramosBase = tramos.filter((x): x is TramoBase => x === 'base' || x === 'izq' || x === 'der');
  const equipos = listarEquipamiento(d);
  const movibles = equipos.filter((e) => e.tipo === 'encimera' || e.tipo === 'lavaplatos' || e.tipo === 'horno');
  const configurables = equipos.filter((e) => e.tipo === 'encimera' || e.tipo === 'lavaplatos');
  const tb = tramosBaseDe(d, z);
  const nb = cuerposDe(d, tb).length;
  const tipo = z.uno(tiposPermitidos(d, t));
  const cambios: Partial<Cuerpo> = z.uno([
    { tipo },
    { puertas: z.entero(0, 4) },
    { cajones: z.entero(0, 5), puertas: z.entero(0, 2) },
    { bisagra: z.uno(['izq', 'der'] as const) },
    { pisos: z.entero(1, 4) },
    { cajonesArriba: z.r() < 0.5, altoCajon: z.uno([0, 120, 180, 600]) },
    { ancho: z.entero(100, 1300) },
    { abatible: z.r() < 0.5 },
  ]);
  const opciones: Operacion[] = [
    { op: 'fijarAncho', ancho: z.entero(300, 4000) },
    { op: 'fijarAlto', alto: z.entero(600, 2400) },
    { op: 'fijarProfundidad', profundidad: z.entero(300, 750) },
    { op: 'fijarSeparacion', separacion: z.uno([0, 0, 10, 40]) },
    { op: 'fijarForma', forma: z.uno(FORMAS) },
    { op: 'fijarLado', lado: z.uno(['izq', 'der'] as const), largo: z.entero(700, 3200), profundidad: z.uno([undefined, 450, 550, 650]) },
    { op: 'agregarModulo', tramo: t, preset: z.uno(presetsModulo(d.plantilla, t).map((p) => p.id).concat('campana')), posicion: z.entero(0, n), ajustarLargo: z.r() < 0.25 },
    { op: 'agregarModulo', tramo: t, preset: z.uno(presetsModulo(d.plantilla, t).map((p) => p.id).concat('campana')), posicion: z.entero(0, n) },
    { op: 'quitarModulo', tramo: t, modulo, ajustarLargo: z.r() < 0.25 },
    { op: 'moverModulo', tramo: t, modulo, delta: z.uno([-1, 1] as const) },
    { op: 'actualizarModulo', tramo: t, modulo, cambios },
    { op: 'actualizarModulo', tramo: t, modulo, cambios },
    { op: 'fijarAnchoModulo', tramo: t, modulo, ancho: z.entero(100, 1400) },
    {
      op: 'agregarEquipo',
      equipo: z.uno(['encimera', 'lavaplatos', 'campana', 'horno', 'llave'] as const),
      tramo: tramosBase.length ? z.uno(tramosBase) : 'base',
      ...(z.r() < 0.5 ? { modulo } : {}),
      platos: z.uno(['2', '3', '4'] as const),
      modelo: z.uno(['simple', 'doble'] as const),
      ubicacion: z.uno(['centro', 'izq', 'der'] as const),
      margen: z.entero(0, 300),
    },
    { op: 'quitarEquipo', id: equipos.length ? z.uno(equipos).id : 'nada' },
    { op: 'moverEquipo', id: movibles.length ? z.uno(movibles).id : 'nada', tramo: tb, modulo: z.entero(0, Math.max(0, nb - 1)) },
    { op: 'moverEquipo', id: movibles.length ? z.uno(movibles).id : 'nada', tramo: tb, modulo: z.entero(0, Math.max(0, nb - 1)) },
    { op: 'agregarCuerpo', tramo: t, tipo, posicion: z.entero(0, n) },
    { op: 'configurarEquipo', id: configurables.length ? z.uno(configurables).id : 'nada', cambios: { platos: z.uno(['2', '3', '4'] as const), posicion: z.uno(['centro', 'izq', 'der'] as const), margen: z.entero(20, 400), llave: z.r() < 0.5, campana: z.r() < 0.5, modelo: z.uno(['simple', 'doble'] as const) } },
    { op: 'activarAereos', activo: z.r() < 0.8 },
    { op: 'fijarAereos', alto: z.uno([undefined, 400, 600, 700, 900]), profundidad: z.uno([undefined, 250, 300, 350, 450]), elevacion: z.uno([undefined, 1300, 1450]), alineacion: z.uno(['izq', 'centro', 'der'] as const) },
    { op: 'fijarFormaAereos', forma: z.uno(FORMAS) },
    { op: 'fijarLadoAereo', lado: z.uno(['izq', 'der'] as const), largo: z.uno([undefined, 600, 1200, 2500]), profundidad: z.uno([undefined, 300, 400]) },
    { op: 'fijarLargoAereos', largo: z.entero(200, 5200) },
    { op: 'fijarAereosCuadrados', cuadrado: z.r() < 0.6 },
    { op: 'fijarCocina', cambios: { vueloCubierta: z.entero(0, 80), copete: z.r() < 0.5 } },
    { op: 'fijarAcabados', zocalo: z.entero(0, 250), luzFrentes: z.entero(0, 12), espesor: z.uno([15, 18] as const) },
  ];
  return z.uno(opciones);
}

function tramosBaseDe(d: Diseno, z: ReturnType<typeof azar>): TramoBase {
  return z.uno(tramosDe(d).filter((x): x is TramoBase => x === 'base' || x === 'izq' || x === 'der'));
}

function revisarGeometria(d: Diseno) {
  const layouts = [calcularLayout(d), ...(['izq', 'der'] as const).map((l) => disenoLado(d, l)).filter((x): x is Diseno => !!x).map(calcularLayout)];
  for (const l of layouts) for (const f of l.frentes) expect(Number.isFinite(f.rect.x0 + f.rect.x1 + f.rect.y0 + f.rect.y1)).toBe(true);
  for (const la of [calcularLayoutAereos(d), calcularLayoutAereosLado(d, 'izq'), calcularLayoutAereosLado(d, 'der')]) {
    if (la) for (const f of la.frentes) expect(Number.isFinite(f.rect.x0 + f.rect.x1)).toBe(true);
  }
  for (const u of ubicarEquipos(d)) expect(Number.isFinite(u.s + u.mundo.x + u.mundo.z)).toBe(true);
}

/**
 * Agregar o quitar un módulo no cambia el largo del tramo y deja parejos los módulos que absorben
 * el cambio (salvo los que topan su mínimo o máximo de reparto; en los aéreos con campana, esta se
 * centra sobre su encimera).
 */
function revisarReparto(antes: Diseno, despues: Diseno, tramo: Tramo, donde: string) {
  const t = resolverTramo(antes, tramo);
  if (!t) return;
  expect(largoTramo(despues, t), donde).toBe(largoTramo(antes, t));
  if (t === 'base') expect(despues.ancho, donde).toBe(antes.ancho);
  const cs = cuerposDe(despues, t);
  if (t.startsWith('aereos') && cs.some((c) => (c.tipo === 'campana' || c.tipo === 'espacio-campana') && c.campanaDe)) return;
  // Solo se reparten los que absorben (en las cocinas, las cajoneras del base y los abatibles de
  // los aéreos, de 60 a 90 cm o desde lo que medían si ya eran más angostas).
  const previos = new Map(cuerposDe(antes, t).map((c) => [c.id, c]));
  const libres = cs
    .filter((c) => {
      // Los fijados a mano conservan su medida (no se reparten con los demás).
      if (c.manual) return false;
      if (!absorbe(despues, t, c)) return false;
      const l = limitesReparto(despues, t, previos.get(c.id) ?? c);
      return c.ancho > l.min && c.ancho < l.max;
    })
    .map((c) => c.ancho);
  if (libres.length > 1) expect(Math.max(...libres) - Math.min(...libres), `${donde}: ${JSON.stringify(cs.map((c) => c.ancho))}`).toBeLessThanOrEqual(1);
}

const productos = JSON.parse(fs.readFileSync('public/datos/productos-respaldo.json', 'utf8')) as ProductoTienda[];
const inicios: [string, () => Diseno][] = [
  ['cocina full equipo', () => disenoInicial(clasificarProducto(productos.find((p) => p.id === 16)!))],
  ['cocina con lavaplatos', () => disenoInicial(clasificarProducto(productos.find((p) => p.id === 24)!))],
  ['cocina libre en U con aéreos', () => ejecutar(ejecutar(disenoLibre('cocina'), { op: 'fijarForma', forma: 'U' }).diseno, { op: 'activarAereos', activo: true }).diseno],
  ['compacto 5C', () => disenoInicial(clasificarProducto(productos.find((p) => p.id === 154)!))],
  ['compacto 3C', () => disenoInicial(clasificarProducto(productos.find((p) => p.id === 153)!))],
  ['cocina infantil', () => disenoLibre('cocina-infantil')],
  ['clóset', () => disenoLibre('closet')],
  ['escritorio', () => disenoLibre('escritorio')],
];

describe('secuencias aleatorias de operaciones', () => {
  for (const [nombre, inicial] of inicios) {
    it(`${nombre}: cada paso deja un diseño válido`, () => {
      for (const semilla of [1, 2, 3]) {
        const z = azar(semilla * 7919 + nombre.length);
        let d = inicial();
        expect(validarDiseno(d)).toEqual([]);
        const historial: Operacion[] = [];
        const pasos = d.plantilla === 'cocina' ? 250 : 100;
        for (let paso = 0; paso < pasos; paso++) {
          const op = operacionAzar(d, z);
          historial.push(op);
          const r = ejecutar(d, op);
          const donde = `${nombre} semilla ${semilla} paso ${paso}: ${JSON.stringify(op)}`;
          if (!r.ok) {
            expect(r.diseno, donde).toBe(d);
            expect(r.motivo, donde).toBeTruthy();
            continue;
          }
          expect(validarDiseno(r.diseno), `${donde}\n${JSON.stringify(historial.slice(-6))}`).toEqual([]);
          const modulos = op.op === 'agregarCuerpo' || op.op === 'quitarModulo' || (op.op === 'agregarModulo' && op.preset !== 'campana');
          // El mueble sobre el refrigerador alarga (o acorta) el aéreo a propósito: los demás no cambian.
          const refri = (x: Diseno) => x.aereos.cuerpos.filter((c) => c.tipo === 'refrigerador').length;
          const conRefri = refri(d) !== refri(r.diseno);
          if (modulos && !op.ajustarLargo && !conRefri) revisarReparto(d, r.diseno, op.tramo, donde);
          d = r.diseno;
          if (paso % 10 === 0) {
            // Guardar y abrir no cambia nada.
            expect(normalizar(JSON.parse(JSON.stringify(d))), donde).toEqual(d);
            revisarGeometria(d);
            expect(detalleCotizacion(d, null, 'cm', null).length).toBeGreaterThan(3);
            expect(fichaFabricacion(d, null, 'cm', null).secciones.length).toBeGreaterThan(2);
            if (d.plantilla === 'cocina') expect(precioDiseno(d, null, null)!.total).toBeGreaterThan(0);
          }
        }
        expect(normalizar(JSON.parse(JSON.stringify(d)))).toEqual(d);
      }
    });
  }
});
