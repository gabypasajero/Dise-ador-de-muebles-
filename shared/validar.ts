// Invariantes de un diseño válido. Las operaciones de reglas.ts los mantienen; esta
// función los revisa (pruebas, depuración y diseños que llegan de afuera).
import { esAdulta, llevaEquipamiento, moduloCampana, puedeLlevar } from './equipos';
import {
  centroEncimera,
  disenoBase,
  esCocinaAdulta,
  extremosPrincipal,
  inicioAereoPrincipal,
  LADOS,
  ladoAereoActivo,
  MARGEN_MIN_LAVAPLATOS,
  posEnMundo,
  posEnTramo,
  posicionesModulos,
  tramoAereoDe,
} from './layout';
import {
  ANCHO_ESPECIERO,
  ANCHO_HORNO,
  ANCHO_MAX_CAJONERA,
  ANCHO_MIN_CUERPO,
  ANCHO_MIN_HUECO,
  cuerposDe,
  esCajonera,
  largoObjetivo,
  largoTramo,
  resolverTramo,
  TRAMOS_AEREOS,
  TRAMOS_BASE,
} from './tramos';
import type { Diseno, Encimera, TramoId } from './tipos';

/** Lista de problemas del diseño (vacía si cumple todas las reglas). */
export function validarDiseno(d: Diseno): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const tramos: TramoId[] = [...TRAMOS_BASE, ...TRAMOS_AEREOS].filter((t) => resolverTramo(d, t));
  if (d.version !== 2) out.push('versión distinta de 2');
  if (d.plantilla !== 'cocina' && (d.lados?.izq || d.lados?.der)) out.push('solo la cocina tiene lados en L/U');
  for (const t of tramos) {
    const cs = cuerposDe(d, t);
    const aereo = t.startsWith('aereos');
    if (!cs.length && t !== 'aereos') out.push(`${t}: sin módulos`);
    cs.forEach((c, i) => {
      const donde = `${t}[${i}]`;
      if (ids.has(c.id)) out.push(`${donde}: id repetido ${c.id}`);
      ids.add(c.id);
      if (!Number.isInteger(c.ancho)) out.push(`${donde}: ancho no entero ${c.ancho}`);
      if (c.tipo === 'horno' && esCocinaAdulta(d) && c.ancho !== ANCHO_HORNO) out.push(`${donde}: horno de ${c.ancho}`);
      if (c.tipo === 'especiero' && c.ancho !== ANCHO_ESPECIERO) out.push(`${donde}: especiero de ${c.ancho}`);
      if (c.tipo === 'especiero' && !(c.pisos === 2 || c.pisos === 3)) out.push(`${donde}: especiero con ${c.pisos} pisos`);
      const minimo = c.tipo === 'hueco' ? ANCHO_MIN_HUECO : ANCHO_MIN_CUERPO;
      if (c.ancho < minimo) out.push(`${donde}: ${c.ancho} bajo el mínimo ${minimo}`);
      if (!aereo && esCocinaAdulta(d) && esCajonera(c) && c.ancho > ANCHO_MAX_CAJONERA) out.push(`${donde}: cajonera de ${c.ancho}`);
      if (aereo && c.cajones > 0) out.push(`${donde}: cajones en un aéreo`);
      if (!aereo && (c.tipo === 'campana' || c.tipo === 'nicho')) out.push(`${donde}: ${c.tipo} en el mueble base`);
      if (aereo && (c.tipo === 'horno' || c.tipo === 'especiero')) out.push(`${donde}: ${c.tipo} en los aéreos`);
      if (c.puertas < 0 || c.puertas > 4 || c.cajones < 0 || c.cajones > 12) out.push(`${donde}: puertas o cajones fuera de rango`);
    });
    // Suma de anchos = largo del tramo.
    if (cs.length) {
      if (t === 'base') {
        if (largoTramo(d, 'base') !== d.ancho) out.push(`base: suma ${largoTramo(d, 'base')} ≠ ancho ${d.ancho}`);
      } else if (t !== 'aereos' || d.plantilla === 'compacto') {
        const suma = cs.reduce((s, c) => s + c.ancho, 0);
        if (suma !== largoObjetivo(d, t)) out.push(`${t}: suma ${suma} ≠ largo ${largoObjetivo(d, t)}`);
      }
    }
  }
  // Aéreos dentro de los muros.
  if (d.aereos.activo && d.aereos.cuerpos.length && d.aereos.montaje === 'mural') {
    const muros = d.lados?.izq || d.lados?.der || d.aereos.lados?.izq || d.aereos.lados?.der;
    const [x0, x1] = extremosPrincipal(d);
    const a0 = inicioAereoPrincipal(d);
    const a1 = a0 + d.aereos.cuerpos.reduce((s, c) => s + c.ancho, 0);
    if (muros && (a0 < x0 - 1 || a1 > x1 + 1)) out.push(`aéreos fuera de los muros (${a0}..${a1} en ${x0}..${x1})`);
    if (d.aereos.lados?.izq && d.aereos.lados?.der && Math.abs(a1 - a0 - (x1 - x0)) > 1) out.push('aéreo en U que no va de muro a muro');
    if (d.aereos.cuadrado && d.plantilla === 'cocina') {
      if (Math.abs(a1 - a0 - (x1 - x0)) > 1) out.push('aéreo cuadrado con otro largo que el base');
      for (const lado of LADOS) {
        const b = d.lados?.[lado];
        const a = d.aereos.lados?.[lado];
        if (!!b !== !!a) out.push(`aéreo cuadrado sin el lado ${lado} del base`);
        if (b && a && a.largo !== b.largo) out.push(`aéreo cuadrado: lado ${lado} de ${a.largo} y base de ${b.largo}`);
      }
    }
  }
  if (d.plantilla === 'compacto' && d.aereos.cuerpos.length && largoTramo(d, 'aereos') !== d.ancho) out.push('superior del compacto con otro ancho');
  // Equipamiento.
  const equipos = d.equipos ?? [];
  if (!llevaEquipamiento(d.plantilla) && equipos.length) out.push('equipamiento en un mueble que no es cocina');
  const vistos = new Set<string>();
  for (const e of equipos) {
    if (!resolverTramo(d, e.tramo) || !(TRAMOS_BASE as string[]).includes(e.tramo)) {
      out.push(`${e.id}: tramo ${e.tramo} inexistente`);
      continue;
    }
    const cs = cuerposDe(d, e.tramo);
    const i = cs.findIndex((c) => c.id === e.modulo);
    if (i < 0) {
      out.push(`${e.id}: módulo ${e.modulo} inexistente`);
      continue;
    }
    if (!puedeLlevar(d, e.tipo, e.tramo, cs[i], i)) out.push(`${e.id}: ${e.tipo} sobre un ${cs[i].tipo}`);
    const clave = `${e.tipo}:${e.tramo}:${e.modulo}`;
    if (vistos.has(clave)) out.push(`${e.id}: dos ${e.tipo} en el mismo módulo`);
    vistos.add(clave);
    if (e.tipo === 'lavaplatos') {
      if (e.margen < MARGEN_MIN_LAVAPLATOS) out.push(`${e.id}: margen ${e.margen} bajo 50`);
      if (!esAdulta(d.plantilla) && (e.llave || e.modelo !== 'simple')) out.push(`${e.id}: opciones de cocina adulta`);
    } else {
      if (esAdulta(d.plantilla) && e.platos === '2') out.push(`${e.id}: encimera de 2 platos en cocina adulta`);
      if (!esAdulta(d.plantilla) && e.campana) out.push(`${e.id}: campana en cocina infantil`);
    }
  }
  // Campana sobre su encimera; ningún módulo de campana suelto en los aéreos visibles.
  const db = disenoBase(d);
  for (const ta of TRAMOS_AEREOS) {
    const visible = d.aereos.activo && cuerposDe(d, ta).length > 0 && (ta === 'aereos' || !!ladoAereoActivo(d, ta === 'aereos-izq' ? 'izq' : 'der'));
    if (!visible) continue;
    const pos = posicionesModulos(d, ta);
    cuerposDe(d, ta).forEach((c, k) => {
      if (c.tipo !== 'campana') return;
      const e = equipos.find((x): x is Encimera => x.tipo === 'encimera' && x.id === c.campanaDe);
      if (!e || !e.campana || tramoAereoDe(e.tramo) !== ta) {
        out.push(`${ta}[${k}]: módulo de campana sin su encimera`);
        return;
      }
      const sb = centroEncimera(db, e);
      const s = sb == null ? NaN : posEnTramo(d, ta, posEnMundo(db, e.tramo, sb));
      if (!(pos[k].s0 - 1 <= s && s <= pos[k].s1 + 1)) out.push(`${ta}[${k}]: campana fuera de su encimera (${Math.round(s)} en ${pos[k].s0}..${pos[k].s1})`);
    });
  }
  for (const e of equipos) {
    if (e.tipo !== 'encimera' || !e.campana) continue;
    const ta = tramoAereoDe(e.tramo);
    const visible = d.aereos.activo && cuerposDe(d, ta).length > 0 && (ta === 'aereos' || !!ladoAereoActivo(d, ta === 'aereos-izq' ? 'izq' : 'der'));
    if (!visible) continue;
    const sb = centroEncimera(db, e);
    const L = cuerposDe(d, ta).reduce((s, c) => s + c.ancho, 0);
    const s = sb == null ? NaN : posEnTramo(d, ta, posEnMundo(db, e.tramo, sb));
    if (s >= 0 && s <= L && !moduloCampana(d, e.id)) out.push(`${e.id}: campana sin módulo en los aéreos que la cubren`);
  }
  return out;
}
