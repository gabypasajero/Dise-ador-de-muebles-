// Revisión final del motor contra los requisitos de la tienda: horno entre lados, campana
// siempre centrada, choques de equipos, motivos de rechazo, operaciones del asistente de
// IA y ficha del maestro.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial } from '../shared/catalogo';
import { contextoAsistente, destinosEquipo, ejecutarVarias } from '../shared/asistente';
import { centroEncimera, ubicarEquipos } from '../shared/layout';
import {
  activarAereos,
  advertencias,
  agregarEquipo,
  agregarModulo,
  configurarEquipo,
  cuerposDe,
  describirOperaciones,
  ejecutar,
  fijarAncho,
  fijarForma,
  fijarLado,
  largoTramo,
  moverEquipo,
  OPERACIONES,
  precioReferencial,
  presetsModulo,
  revisarOperacion,
  type Operacion,
} from '../shared/reglas';
import { detalleCotizacion, fichaFabricacion, textoFicha } from '../shared/resumen';
import { TARIFAS } from '../shared/tarifas';
import { validarDiseno } from '../shared/validar';
import type { Diseno, Encimera, Lavaplatos, ProductoTienda } from '../shared/tipos';

const productos = JSON.parse(fs.readFileSync('public/datos/productos-respaldo.json', 'utf8')) as ProductoTienda[];
const prod = (id: number) => clasificarProducto(productos.find((x) => x.id === id)!);
const full = () => disenoInicial(prod(16));
const encimera = (d: Diseno) => d.equipos.find((e): e is Encimera => e.tipo === 'encimera')!;
const lavaplatos = (d: Diseno) => d.equipos.find((e): e is Lavaplatos => e.tipo === 'lavaplatos')!;
const preset = (id: string) => presetsModulo('cocina').find((p) => p.id === id)!;

/** Distancia en planta (mm) entre cada campana y su encimera. */
function desfaseCampanas(d: Diseno): number[] {
  const u = ubicarEquipos(d);
  return u
    .filter((x) => x.tipo === 'campana')
    .map((c) => {
      const e = u.find((x) => x.id === c.encimera)!;
      return Math.hypot(c.mundo.x - e.mundo.x, c.mundo.z - e.mundo.z);
    });
}

/** Cocina en U de 240 cm con lados de 180 (izq) y 200 cm (der). */
const enU = () => fijarLado(fijarLado(fijarForma(fijarAncho(full(), 2400), 'U'), 'izq', { largo: 1800 }), 'der', { largo: 2000 });

describe('horno entre tramos', () => {
  it('pasa a un lado de un solo módulo: el horno toma 60 cm y lo demás queda como módulo aparte', () => {
    const d = enU();
    expect(d.lados.der!.cuerpos).toHaveLength(1);
    const horno = d.cuerpos.find((c) => c.tipo === 'horno')!;
    const r = ejecutar(d, { op: 'moverEquipo', id: horno.id, tramo: 'der', modulo: 0 });
    expect(r.ok).toBe(true);
    const der = r.diseno.lados.der!;
    expect(der.cuerpos.map((c) => [c.tipo, c.ancho])).toEqual([
      ['horno', 600],
      ['frentes', 800],
    ]);
    // Ningún tramo cambia de largo y el módulo donde estaba el horno conserva sus 60 cm.
    expect(der.largo).toBe(2000);
    expect(r.diseno.ancho).toBe(2400);
    expect(r.diseno.cuerpos[0]).toMatchObject({ id: horno.id, tipo: 'frentes', ancho: 600 });
    expect(r.avisos.join(' ')).toMatch(/los 80 cm que sobran/);
    expect(validarDiseno(r.diseno)).toEqual([]);
  });

  it('sin espacio para un módulo más, el horno va bajo la encimera', () => {
    let d = disenoInicial(prod(154));
    d = agregarEquipo(d, 'encimera', { modulo: 0 });
    d = agregarEquipo(d, 'lavaplatos', { modulo: 2 });
    const r = ejecutar(d, { op: 'agregarEquipo', equipo: 'horno' });
    expect(r.ok).toBe(true);
    expect(r.diseno.cuerpos[0]).toMatchObject({ tipo: 'horno', ancho: 600 });
    expect(encimera(r.diseno).modulo).toBe(r.diseno.cuerpos[0].id);
    expect(r.diseno.ancho).toBe(d.ancho);
    expect(r.avisos.join(' ')).toMatch(/el horno quedó en el módulo 1/);
    expect(validarDiseno(r.diseno)).toEqual([]);
  });
});

describe('la campana siempre centrada sobre la encimera', () => {
  it('en la punta del mueble la encimera con campana se separa lo que pide la campana', () => {
    let d = agregarModulo(fijarAncho(full(), 2400), preset('puerta'));
    d = activarAereos(d, true);
    d = moverEquipo(d, encimera(d).id, 'base', d.cuerpos.length - 1);
    d = agregarEquipo(d, 'campana');
    expect(centroEncimera(d, encimera(d))).toBe(2400 - 300);
    expect(desfaseCampanas(d)).toEqual([0]);
    expect(validarDiseno(d)).toEqual([]);
  });

  it('un aéreo a medida no corta la campana: la cubre entera o termina antes', () => {
    let d = enU();
    d = moverEquipo(d, encimera(d).id, 'der', 0);
    d = agregarEquipo(activarAereos(d, true), 'campana');
    expect(desfaseCampanas(d)).toEqual([0]);
    // La encimera queda a 130 cm del muro principal: la campana va de 100 a 160 cm.
    // Con 140 cm quedaría a medias: el largo más cercano que la aloja entera es 160.
    const r = ejecutar(d, { op: 'fijarLadoAereo', lado: 'der', largo: 1400 });
    expect(r.ok).toBe(true);
    expect(r.diseno.aereos.cuadrado).toBe(false);
    expect(r.diseno.aereos.lados.der!.largo).toBe(1600);
    expect(r.avisos.join(' ')).toMatch(/quedó en 160 cm: con 140 cm la campana quedaría a medias/);
    expect(desfaseCampanas(r.diseno)).toEqual([0]);
    expect(validarDiseno(r.diseno)).toEqual([]);
    // Con 110 cm lo más cercano es terminar antes de la campana (100 cm): queda mural y no lo toca.
    const corto = ejecutar(d, { op: 'fijarLadoAereo', lado: 'der', largo: 1100 });
    expect(corto.diseno.aereos.lados.der!.largo).toBe(1000);
    expect(ubicarEquipos(corto.diseno).find((u) => u.tipo === 'campana')).toMatchObject({ montaje: 'mural', tramo: 'der' });
    expect(corto.diseno.aereos.lados.der!.cuerpos.some((c) => c.tipo === 'campana')).toBe(false);
    expect(validarDiseno(corto.diseno)).toEqual([]);
  });

  it('lo mismo en el aéreo principal centrado y más corto que el base', () => {
    let d = activarAereos(fijarAncho(full(), 2400), true);
    d = agregarEquipo(ejecutar(d, { op: 'fijarAereos', alineacion: 'centro' }).diseno, 'campana');
    // Encimera sobre el horno: centro en x = −90 cm; la campana va de −120 a −60 cm.
    const corto = ejecutar(d, { op: 'fijarLargoAereos', largo: 1500 });
    expect(largoTramo(corto.diseno, 'aereos')).toBe(1200);
    expect(ubicarEquipos(corto.diseno).find((u) => u.tipo === 'campana')).toMatchObject({ montaje: 'mural' });
    expect(validarDiseno(corto.diseno)).toEqual([]);
    const largo = ejecutar(d, { op: 'fijarLargoAereos', largo: 2000 });
    expect(largoTramo(largo.diseno, 'aereos')).toBe(2400);
    expect(desfaseCampanas(largo.diseno)).toEqual([0]);
    expect(validarDiseno(largo.diseno)).toEqual([]);
  });

  it('si otro cambio deja el aéreo terminando sobre la campana, el aéreo se alarga para alojarla', () => {
    let d = enU();
    d = moverEquipo(d, encimera(d).id, 'der', 0);
    d = agregarEquipo(activarAereos(d, true), 'campana');
    d = ejecutar(d, { op: 'fijarLadoAereo', lado: 'der', largo: 1600 }).diseno;
    // El lado del base se alarga: su módulo crece y la encimera (centrada en él) se corre a 140 cm.
    const r = ejecutar(d, { op: 'fijarLado', lado: 'der', largo: 2200 });
    expect(r.ok).toBe(true);
    expect(r.diseno.aereos.lados.der!.largo).toBe(1700);
    expect(r.avisos.join(' ')).toMatch(/se alargó 10 cm para que la campana quede entera y centrada/);
    expect(desfaseCampanas(r.diseno)).toEqual([0]);
    expect(validarDiseno(r.diseno)).toEqual([]);
  });
});

describe('encimera y lavaplatos no se topan', () => {
  it('no se ponen juntos en un módulo que no da para los dos', () => {
    const d = fijarAncho(full(), 2400);
    const r = ejecutar(d, { op: 'moverEquipo', id: encimera(d).id, tramo: 'base', modulo: 2 });
    expect(r.ok).toBe(false);
    expect(r.diseno).toBe(d);
    expect(r.motivo).toMatch(/no caben juntos en el módulo 3/);
    expect(ejecutar(d, { op: 'agregarEquipo', equipo: 'lavaplatos', modulo: 0 }).motivo).toMatch(/va sobre un módulo de puertas o cajones/);
  });

  it('en un módulo ancho caben si el lavaplatos va pegado a un borde', () => {
    let d = fijarAncho(agregarModulo(fijarAncho(full(), 3000), preset('puerta'), 1), 3600);
    const i = d.cuerpos.findIndex((c) => c.id === lavaplatos(d).modulo);
    expect(d.cuerpos[i].ancho).toBeGreaterThanOrEqual(1500);
    d = configurarEquipo(d, lavaplatos(d).id, { posicion: 'der', margen: 50 });
    const r = ejecutar(d, { op: 'moverEquipo', id: encimera(d).id, tramo: 'base', modulo: i });
    expect(r.ok).toBe(true);
    expect(advertencias(r.diseno).some((a) => a.texto.includes('se topan'))).toBe(false);
    // Volver a centrarlo sí chocaría.
    expect(ejecutar(r.diseno, { op: 'configurarEquipo', id: lavaplatos(d).id, cambios: { posicion: 'centro' } }).motivo).toMatch(/no caben juntos/);
  });

  it('el lavaplatos nuevo prefiere un módulo de puertas y que le dé el ancho', () => {
    let d = fijarLado(enU(), 'izq', { largo: 2000 });
    d = agregarModulo(d, preset('cajonera'), 0, 'izq');
    d = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'izq', modulo: 0, ancho: 900 }).diseno;
    expect(cuerposDe(d, 'izq').map((c) => [c.cajones, c.puertas, c.ancho])).toEqual([
      [3, 0, 900],
      [0, 2, 500],
    ]);
    const enModulo = (r: ReturnType<typeof ejecutar>) => cuerposDe(r.diseno, 'izq').findIndex((x) => x.id === (r.diseno.equipos.find((e) => e.id === r.id) as Lavaplatos).modulo);
    // El simple cabe en el de puertas (no va sobre los cajones aunque sean más anchos)…
    expect(enModulo(ejecutar(d, { op: 'agregarEquipo', equipo: 'lavaplatos', tramo: 'izq' }))).toBe(1);
    // …y el doble necesita 80 cm: solo cabe en la cajonera.
    expect(enModulo(ejecutar(d, { op: 'agregarEquipo', equipo: 'lavaplatos', tramo: 'izq', modelo: 'doble' }))).toBe(0);
  });

  it('una encimera no va en un módulo angosto de la punta (se saldría de la cubierta)', () => {
    let d = agregarModulo(fijarAncho(full(), 2400), preset('puerta'));
    d = ejecutar(d, { op: 'fijarAnchoModulo', tramo: 'base', modulo: d.cuerpos.length - 1, ancho: 200 }).diseno;
    expect(d.cuerpos.at(-1)!.ancho).toBe(200);
    const r = ejecutar(d, { op: 'moverEquipo', id: encimera(d).id, tramo: 'base', modulo: d.cuerpos.length - 1 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/se saldría de la cubierta/);
  });
});

describe('rechazos con motivo, sin ofrecer cambiar la medida del mueble', () => {
  it('dicen por qué no cabe y no ofrecen agrandar ni achicar el mueble', () => {
    const d = full();
    const r = ejecutar(d, { op: 'agregarModulo', tramo: 'base', preset: 'horno' });
    expect(r.ok).toBe(false);
    expect(r.diseno).toBe(d);
    expect(r.motivo).toMatch(/^No cabe «Horno empotrado» de 60 cm en 150 cm: /);
    expect(r.motivo).toMatch(/\(el horno de 60 cm y el módulo 3 con el lavaplatos conservan su ancho\)/);
    expect(r.motivo).toMatch(/Quita uno o cambia la medida del mueble\.$/);
    expect(r.motivo).not.toMatch(/agrand|achic|crec/);
    expect(r).not.toHaveProperty('alternativa');
    // Quitar la cajonera tampoco se puede: los que quedan conservan su ancho.
    const q = ejecutar(d, { op: 'quitarModulo', tramo: 'base', modulo: 1 });
    expect(q.ok).toBe(false);
    expect(q.motivo).toMatch(/^No se puede quitar el módulo 2: los módulos que quedan conservan su ancho \(el horno de 60 cm y el módulo 3 con el lavaplatos\) y ninguno puede tomar sus 45 cm\./);
    expect(q.motivo).not.toMatch(/agrand|achic|crec/);
    expect(q).not.toHaveProperty('alternativa');
  });

  it('el aviso de un lado quitado habla en singular cuando corresponde', () => {
    const r = ejecutar(fijarForma(full(), 'der'), { op: 'fijarForma', forma: 'lineal' });
    expect(r.avisos.join(' ')).toMatch(/Se quitó el lado derecho con su módulo\./);
  });
});

describe('operaciones del asistente de IA', () => {
  it('revisa el JSON antes de ejecutarlo y explica qué está mal', () => {
    const d = full();
    const casos: [unknown, RegExp][] = [
      [null, /campo «op»/],
      [{ op: 'pintar' }, /no es una operación conocida/],
      [{ op: 'fijarAncho' }, /Falta «ancho»/],
      [{ op: 'fijarAncho', ancho: '240' }, /número en milímetros/],
      [{ op: 'agregarModulo', tramo: 'lateral', preset: 'puerta' }, /«tramo» debe ser uno de/],
      [{ op: 'actualizarModulo', tramo: 'base', modulo: 0, cambios: { puertas: 'dos' } }, /cambios.puertas/],
      [{ op: 'fijarForma', forma: 'L' }, /«forma» debe ser uno de: lineal, L-izq, L-der, U/],
      [{ op: 'fijarAncho', ancho: 2000, color: 'rojo' }, /«color» no es un campo/],
    ];
    for (const [op, motivo] of casos) {
      expect(revisarOperacion(op)).toMatch(motivo);
      const r = ejecutar(d, op as Operacion);
      expect(r.ok).toBe(false);
      expect(r.diseno).toBe(d);
    }
    for (const o of OPERACIONES) expect(revisarOperacion(o.ejemplo), o.op).toBeNull();
    expect(describirOperaciones()).toContain('moverEquipo { id: texto, tramo: tramo, modulo: modulo }');
  });

  it('una instrucción con varias operaciones se aplica entera o no se aplica', () => {
    const d = full();
    const ok = ejecutarVarias(d, [
      { op: 'fijarAncho', ancho: 2400 },
      { op: 'fijarForma', forma: 'U' },
      { op: 'activarAereos', activo: true },
      { op: 'agregarEquipo', equipo: 'campana' },
    ]);
    expect(ok.ok).toBe(true);
    expect(ok.diseno.lados.izq && ok.diseno.lados.der).toBeTruthy();
    expect(validarDiseno(ok.diseno)).toEqual([]);
    const mal = ejecutarVarias(d, [
      { op: 'fijarAncho', ancho: 2400 },
      { op: 'agregarEquipo', equipo: 'horno', modulo: 2 },
    ]);
    expect(mal).toMatchObject({ ok: false, fallo: 1 });
    expect(mal.motivo).toMatch(/tiene el lavaplatos/);
    expect(mal.diseno).toBe(d);
  });

  it('el contexto nombra cada tramo, módulo y equipo con sus ids', () => {
    const d = agregarEquipo(activarAereos(enU(), true), 'campana');
    const c = contextoAsistente(d);
    expect(c.forma).toBe('U');
    expect(c.formaAereos).toBe('U');
    expect(c.tramos.map((t) => t.tramo)).toEqual(['base', 'izq', 'der', 'aereos', 'aereos-izq', 'aereos-der']);
    const der = c.tramos.find((t) => t.tramo === 'der')!;
    expect(der).toMatchObject({ nombre: 'Lado derecho', largoExterior: 2000, largo: 1400 });
    const base = c.tramos.find((t) => t.tramo === 'base')!;
    expect(base.modulos[0]).toMatchObject({ indice: 0, nombre: 'módulo 1', tipo: 'horno', rol: 'fijo', min: 600, max: 600 });
    expect(base.modulos[0].equipos).toContain(encimera(d).id);
    expect(c.equipamiento.map((e) => e.tipo)).toEqual(['horno', 'encimera', 'campana', 'lavaplatos', 'llave']);
    expect(c.precio).toMatchObject({ metodo: 'oficial' });
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
  });
});

describe('destinos de un equipo para la interfaz', () => {
  it('lista los módulos de todos los lados y dice por qué no sirven los que no', () => {
    const d = enU();
    const dest = destinosEquipo(d, lavaplatos(d).id);
    expect(dest.map((x) => x.tramo)).toEqual(['base', 'base', 'base', 'izq', 'der']);
    expect(dest.find((x) => x.actual)).toMatchObject({ tramo: 'base', indice: 2, ok: true });
    expect(dest[0]).toMatchObject({ ok: false });
    expect(dest[0].motivo).toMatch(/el horno/);
    expect(dest.filter((x) => x.tramo !== 'base').every((x) => x.ok)).toBe(true);
    expect(destinosEquipo(d, 'nada')).toEqual([]);
  });
});

describe('documentos', () => {
  it('la ficha del maestro trae piezas y cortes de cubierta, cotas desde los muros y la campana', () => {
    let d = enU();
    d = moverEquipo(d, encimera(d).id, 'der', 0);
    d = configurarEquipo(d, lavaplatos(d).id, { posicion: 'izq', margen: 100 });
    const texto = textoFicha(fichaFabricacion(d, prod(16), 'cm', null));
    expect(texto).toContain('Módulo 2 · 90 cm: Cajonera de 3 cajones');
    expect(texto).toContain('tramo principal: 360 × 60 cm (cubre las esquinas)');
    expect(texto).toContain('lado derecho: 140 × 60 cm');
    expect(texto).toMatch(/encimera 4 platos: 58 × 51 cm \(módulo 1 del lado derecho\), centro a 130 cm del muro principal/);
    expect(texto).toMatch(/lavaplatos simple: 40 × 36 cm \(módulo 3\), centro a 240 cm del muro izquierdo, a 10 cm del borde izquierdo/);
    expect(texto).toContain('Llave negro mate');
    expect(texto).toMatch(/de 60 a 120 cm del muro izquierdo/);
    expect(texto).toMatch(/Frentes: \d+ módulos/);
    const conCampana = agregarEquipo(d, 'campana');
    expect(textoFicha(fichaFabricacion(conCampana, null, 'cm', null))).toMatch(/Campana 60 cm: mural, sobre la encimera del módulo 1 del lado derecho; centro a 130 cm del muro principal/);
  });

  it('en la L y la U el cliente ve el largo del tramo principal con las esquinas', () => {
    const d = enU();
    const medidas = detalleCotizacion(d, null, 'cm', null).find((l) => l.etiqueta === 'Medidas')!;
    expect(medidas.valor).toBe('360 × 90 × 60 cm (tramo principal con las esquinas × alto × profundidad)');
    const lineal = detalleCotizacion(full(), null, 'cm', null).find((l) => l.etiqueta === 'Medidas')!;
    expect(lineal.valor).toBe('150 × 90 × 60 cm (ancho × alto × profundidad)');
  });

  it('las advertencias no se repiten', () => {
    const d = enU();
    const textos = advertencias(d).map((a) => a.texto);
    expect(new Set(textos).size).toBe(textos.length);
  });
});

describe('precio del compacto', () => {
  it('conserva su precio y suma el horno y la campana nuevos a su valor de tarifa', () => {
    const p = prod(154);
    const base = disenoInicial(p);
    const conEncimera = agregarEquipo(fijarAncho(base, 2400), 'encimera', { modulo: 0 });
    const conHorno = agregarEquipo(conEncimera, 'horno', { modulo: 0 });
    expect(conHorno.cuerpos.some((c) => c.tipo === 'horno')).toBe(true);
    const sinHorno = precioReferencial(conEncimera, p, base)!;
    const conH = precioReferencial(conHorno, p, base)!;
    // El horno se suma a su valor de tarifa (los frentes que reemplaza se descuentan aparte).
    expect(conH - sinHorno).toBeGreaterThan(TARIFAS.horno - 40000);
    expect(precioReferencial(base, p, base)).toBe(Math.round((p.precio_oferta ?? p.precio) / 1000) * 1000 - 10);
  });
});
