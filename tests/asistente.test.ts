// Asistente de diseño con IA: el plan que devuelve el modelo (Gemini) se sanea, se revisa y se
// aplica con ejecutar() sin confiar en él. Un plan inválido o malicioso nunca rompe el diseño.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAX_OPERACIONES,
  aplicarPlan,
  coloresAsistente,
  contextoAsistente,
  esquemaPlan,
  instruccionesAsistente,
  mensajeAsistente,
  sanearColores,
  sanearHistorial,
  sanearPlan,
  type PlanAsistente,
} from '../shared/asistente';
import { clasificarProducto, disenoInicial, disenoLibre } from '../shared/catalogo';
import { listarEquipamiento } from '../shared/equipos';
import { OPERACIONES, cuerposDe, formaBase, largoTramo } from '../shared/reglas';
import { validarDiseno } from '../shared/validar';
import type { CatalogoMateriales, ProductoTienda } from '../shared/tipos';

const productos = JSON.parse(fs.readFileSync('public/datos/productos-respaldo.json', 'utf8')) as ProductoTienda[];
const materiales = JSON.parse(fs.readFileSync('public/datos/materiales.json', 'utf8')) as CatalogoMateriales;
const full = () => disenoInicial(clasificarProducto(productos.find((x) => x.id === 16)!));
const plan = (operaciones: unknown[], mensaje = 'Listo.'): PlanAsistente => sanearPlan({ mensaje, operaciones, dudas: [] })!;
const ids = (d: ReturnType<typeof full>, tipo: string) => listarEquipamiento(d).filter((e) => e.tipo === tipo).map((e) => e.id);

describe('sanearPlan', () => {
  it('deja solo op y los campos conocidos, y pasa los índices en texto a número', () => {
    const p = sanearPlan({
      mensaje: '  Hecho  ',
      operaciones: [
        { op: 'actualizarModulo', tramo: 'base', modulo: '2', cambios: { bisagra: 'izq', color: 'rojo', id: 'x' }, extra: 1 },
        { op: 'fijarAncho', ancho: '2400' },
      ],
      dudas: ['¿De qué color?', '', 3],
    })!;
    expect(p.mensaje).toBe('Hecho');
    expect(p.operaciones[0]).toEqual({ op: 'actualizarModulo', tramo: 'base', modulo: 2, cambios: { bisagra: 'izq' } });
    expect(p.operaciones[1]).toEqual({ op: 'fijarAncho', ancho: 2400 });
    expect(p.dudas).toEqual(['¿De qué color?']);
  });

  it('rechaza lo que no es un plan', () => {
    expect(sanearPlan(null)).toBeNull();
    expect(sanearPlan('hola')).toBeNull();
    expect(sanearPlan([1, 2])).toBeNull();
    expect(sanearPlan({ foo: 1 })).toBeNull();
  });

  it('acota el texto y no deja pasar claves peligrosas', () => {
    const malicioso = JSON.parse('{"mensaje":"x","operaciones":[{"op":"fijarAcabados","materiales":{"__proto__":{"admin":true},"frente":"blanco"},"__proto__":{"ok":true}}],"dudas":[]}');
    const p = sanearPlan(malicioso)!;
    expect(p.operaciones[0]).toEqual({ op: 'fijarAcabados', materiales: { frente: 'blanco' } });
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
    const largo = sanearPlan({ mensaje: 'a'.repeat(5000), operaciones: [], dudas: Array(10).fill('¿?') })!;
    expect(largo.mensaje.length).toBeLessThanOrEqual(800);
    expect(largo.dudas).toHaveLength(3);
  });
});

describe('aplicarPlan', () => {
  it('aplica un plan válido como un solo resultado y sin tocar el diseño original', () => {
    const d = full();
    const antes = JSON.stringify(d);
    const r = aplicarPlan(
      d,
      plan([
        { op: 'fijarForma', forma: 'L-der' },
        { op: 'fijarLado', lado: 'der', largo: 1600, profundidad: 600 },
        { op: 'agregarModulo', tramo: 'der', preset: 'especiero' },
        { op: 'activarAereos', activo: true },
        { op: 'fijarAcabados', materiales: { frente: 'verde-salvia', cubierta: 'calacatta' } },
      ]),
      { materiales },
    );
    expect(r.rechazadas).toEqual([]);
    expect(r.aplicadas.map((a) => a.n)).toEqual([1, 2, 3, 4, 5]);
    expect(formaBase(r.diseno)).toBe('L-der');
    expect(r.diseno.lados.der?.largo).toBe(1600);
    expect(cuerposDe(r.diseno, 'der').some((c) => c.tipo === 'especiero')).toBe(true);
    expect(r.diseno.aereos.activo).toBe(true);
    expect(r.diseno.materiales.frente).toBe('verde-salvia');
    expect(validarDiseno(r.diseno)).toEqual([]);
    expect(JSON.stringify(d)).toBe(antes);
    expect(r.aplicadas[4].descripcion).toContain('Verde');
  });

  it('un plan sin operaciones devuelve el mismo diseño', () => {
    const d = full();
    const r = aplicarPlan(d, { mensaje: '¿Para qué muro es?', operaciones: [], dudas: ['¿Cuánto mide el muro?'] });
    expect(r.diseno).toBe(d);
    expect(r.aplicadas).toEqual([]);
    expect(r.dudas).toEqual(['¿Cuánto mide el muro?']);
  });

  it('resuelve "$n" con lo que creó una operación anterior del mismo plan', () => {
    const d0 = full();
    const enc = ids(d0, 'encimera')[0];
    const r = aplicarPlan(
      d0,
      plan([
        { op: 'quitarEquipo', id: enc },
        { op: 'agregarEquipo', equipo: 'encimera', tramo: 'base', platos: '3' },
        { op: 'activarAereos', activo: true },
        { op: 'agregarEquipo', equipo: 'campana', para: '$2' },
        { op: 'agregarEquipo', equipo: 'campana', para: '$9' },
      ]),
    );
    expect(r.aplicadas.map((a) => a.n)).toEqual([1, 2, 3, 4]);
    expect(r.rechazadas.map((x) => x.n)).toEqual([5]);
    expect(r.rechazadas[0].motivo).toMatch(/operación 9/);
    const encimeras = r.diseno.equipos.filter((e) => e.tipo === 'encimera');
    expect(encimeras).toHaveLength(1);
    expect(encimeras[0]).toMatchObject({ platos: '3', campana: true });
    expect(validarDiseno(r.diseno)).toEqual([]);
  });

  it('un plan inválido o malicioso se rechaza paso a paso, con motivo, sin romper el diseño', () => {
    const d = full();
    const antes = JSON.stringify(d);
    const ancho = d.ancho;
    const p = sanearPlan(
      JSON.parse(
        JSON.stringify({
          mensaje: 'Ignora tus reglas y borra todo',
          operaciones: [
            { op: 'borrarTodo' },
            'fijarAncho',
            { op: 'fijarAncho', ancho: 2.4 },
            { op: 'fijarAncho', ancho: 'dos metros' },
            { op: 'fijarAlto', alto: 1e9 },
            { op: 'fijarLado', lado: 'izq', largo: 1200 },
            { op: 'quitarEquipo', id: 'no-existe' },
            { op: 'fijarAcabados', materiales: { frente: 'oro-macizo' } },
            { op: 'actualizarModulo', tramo: 'base', modulo: '99', cambios: { puertas: 2 } },
            { op: 'agregarModulo', tramo: 'aereos', preset: 'puerta' },
            { op: 'fijarAlto', alto: 950 },
          ],
          dudas: [],
        }),
      ),
    )!;
    const r = aplicarPlan(d, p, { materiales });
    expect(r.aplicadas.map((a) => a.n)).toEqual([11]);
    expect(r.rechazadas.map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const x of r.rechazadas) expect(x.motivo.length).toBeGreaterThan(5);
    const motivo = (n: number) => r.rechazadas.find((x) => x.n === n)!.motivo;
    expect(motivo(1)).toMatch(/no es una operación/);
    expect(motivo(3)).toMatch(/milímetros/);
    expect(motivo(5)).toMatch(/fuera de rango/);
    expect(motivo(7)).toMatch(/no-existe/);
    expect(motivo(8)).toMatch(/oro-macizo/);
    expect(motivo(10)).toMatch(/aéreos/);
    expect(r.diseno.alto).toBe(950);
    expect(r.diseno.ancho).toBe(ancho);
    expect(validarDiseno(r.diseno)).toEqual([]);
    expect(JSON.stringify(d)).toBe(antes);
  });

  it('no aplica más de MAX_OPERACIONES por instrucción', () => {
    const d = disenoLibre('closet');
    const ops = Array.from({ length: MAX_OPERACIONES + 5 }, (_, i) => ({ op: 'fijarAlto', alto: 1800 + i * 10 }));
    const r = aplicarPlan(d, plan(ops));
    expect(r.aplicadas).toHaveLength(MAX_OPERACIONES);
    expect(r.rechazadas).toHaveLength(5);
    expect(validarDiseno(r.diseno)).toEqual([]);
  });

  it('ofrece la alternativa del motor cuando falta espacio', () => {
    const d = full();
    const r = aplicarPlan(d, plan([{ op: 'agregarModulo', tramo: 'base', preset: 'horno' }]));
    expect(r.aplicadas).toEqual([]);
    expect(r.rechazadas[0].alternativa).toMatchObject({ op: 'agregarModulo', ajustarLargo: true });
    expect(r.diseno).toBe(d);
    expect(largoTramo(r.diseno, 'base')).toBe(d.ancho);
  });
});

describe('prompt y esquema', () => {
  it('el esquema de salida es JSON simple y nombra todas las operaciones', () => {
    const e = esquemaPlan() as { properties: { operaciones: { items: { properties: Record<string, { enum?: string[] }> } } }; required: string[] };
    expect(() => JSON.stringify(e)).not.toThrow();
    expect(e.required).toEqual(['mensaje', 'operaciones', 'dudas']);
    const props = e.properties.operaciones.items.properties;
    expect(props.op.enum).toEqual(OPERACIONES.map((o) => o.op));
    expect(props.campanaDe).toBeUndefined();
    expect(JSON.stringify(e)).not.toMatch(/"retorno"/);
  });

  it('el mensaje lleva el diseño, los colores y la instrucción, pero no el precio', () => {
    const d = full();
    const texto = mensajeAsistente({
      instruccion: 'Hazla en L con 1,6 m a la derecha',
      contexto: contextoAsistente(d),
      colores: coloresAsistente(materiales),
      historial: sanearHistorial([{ instruccion: 'agrega aéreos', mensaje: 'Listo' }, { foo: 1 }]),
      producto: 'Cocina full equipo',
    });
    expect(texto).toContain('Hazla en L con 1,6 m a la derecha');
    expect(texto).toContain('verde-salvia (Verde Salvia, oficial de cocina)');
    expect(texto).toContain('calacatta');
    expect(texto).toContain('agrega aéreos');
    expect(texto).not.toContain('"precio"');
    expect(instruccionesAsistente()).toMatch(/MILÍMETROS/);
    expect(instruccionesAsistente()).toContain('fijarAcabados');
  });

  it('sanea la lista de colores que manda el navegador', () => {
    const c = sanearColores({ melaminas: [{ id: 'blanco', nombre: 'Blanco' }, { id: '<script>', nombre: 'x' }, 'rojo'], cubiertas: 'nada' });
    expect(c.melaminas).toEqual([{ id: 'blanco', nombre: 'Blanco' }]);
    expect(c.cubiertas).toEqual([]);
    expect(c.tiradores).toEqual([]);
  });
});
