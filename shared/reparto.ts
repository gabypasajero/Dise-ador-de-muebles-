// Reparto de anchos entre módulos: funciones puras sobre listas de anchos (mm
// enteros) con mínimos y máximos. Las usan las operaciones de reglas.ts para
// mantener fijo el largo de cada tramo (al agregar o quitar módulos, los ajustables
// se reparten parejo con repartirParejo).

export interface Limite {
  min: number;
  max: number;
}

const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Anchos enteros que suman exactamente `total`, proporcionales a `pesos` y dentro
 * de sus límites (llenado por niveles: los que topan su mínimo o máximo quedan ahí
 * y el resto se reparte entre los demás). null si el total no cabe en los límites.
 */
export function repartirConLimites(pesos: number[], total: number, lims: Limite[]): number[] | null {
  const n = pesos.length;
  if (!n) return total === 0 ? [] : null;
  const mins = lims.map((l) => Math.ceil(l.min));
  const maxs = lims.map((l) => (Number.isFinite(l.max) ? Math.floor(l.max) : Infinity));
  if (mins.some((m, i) => m > maxs[i])) return null;
  if (total < suma(mins) || total > suma(maxs)) return null;
  const p = pesos.map((x) => Math.max(1, x));
  const f = (k: number) => p.reduce((s, pi, i) => s + Math.min(maxs[i], Math.max(mins[i], k * pi)), 0);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 80 && f(hi) < total; i++) hi *= 2;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < total) lo = mid;
    else hi = mid;
  }
  const reales = p.map((pi, i) => Math.min(maxs[i], Math.max(mins[i], hi * pi)));
  const out = reales.map((r, i) => Math.max(mins[i], Math.min(maxs[i], Math.floor(r))));
  let resto = total - suma(out);
  // Los milímetros que faltan (o sobran) van a los de mayor (o menor) fracción con holgura.
  const orden = reales.map((r, i) => ({ i, fr: r - Math.floor(r) }));
  for (let vuelta = 0; resto !== 0 && vuelta < n * 4 + 8; vuelta++) {
    if (resto > 0) {
      orden.sort((a, b) => b.fr - a.fr);
      for (const { i } of orden) {
        if (resto === 0) break;
        if (out[i] < maxs[i]) {
          out[i]++;
          resto--;
        }
      }
    } else {
      orden.sort((a, b) => a.fr - b.fr);
      for (const { i } of orden) {
        if (resto === 0) break;
        if (out[i] > mins[i]) {
          out[i]--;
          resto++;
        }
      }
    }
  }
  return resto === 0 ? out : null;
}

/**
 * Anchos enteros iguales que suman exactamente `total`, dentro de sus límites: los que
 * pasarían su máximo (cajonera de 90 cm) quedan en él y los que no llegarían a su mínimo
 * quedan en él, y el resto se reparte parejo entre los demás. Los milímetros que no se
 * dividen exacto van de a uno a los primeros. null si el total no cabe en los límites.
 */
export function repartirParejo(total: number, lims: Limite[]): number[] | null {
  return repartirConLimites(
    lims.map(() => 1),
    total,
    lims,
  );
}

/** Reparte un entero entre capacidades (proporcional, sin pasar ninguna). */
function repartirEntero(cantidad: number, caps: number[]): number[] {
  const total = suma(caps);
  if (cantidad >= total) return caps.slice();
  const out = caps.map((c) => Math.floor((cantidad * c) / total));
  let resto = cantidad - suma(out);
  const orden = caps.map((c, i) => ({ i, fr: (cantidad * c) / total - out[i] })).sort((a, b) => b.fr - a.fr);
  while (resto > 0) {
    let avanzo = false;
    for (const { i } of orden) {
      if (resto === 0) break;
      if (out[i] < caps[i]) {
        out[i]++;
        resto--;
        avanzo = true;
      }
    }
    if (!avanzo) break;
  }
  return out;
}

/**
 * Suma `delta` mm a los módulos candidatos (negativo: se los quita), empezando por
 * los más cercanos a `centro` (índice, puede ser fraccionario) y siguiendo por
 * anillos hacia afuera; dentro de un anillo, en proporción a la holgura de cada uno.
 * Modifica `anchos` y devuelve lo que no se pudo absorber (0 si todo).
 */
export function absorberCercanos(anchos: number[], lims: Limite[], candidatos: boolean[], delta: number, centro: number): number {
  let resto = Math.round(delta);
  if (resto === 0) return 0;
  const indices = anchos.map((_, i) => i).filter((i) => candidatos[i]);
  indices.sort((a, b) => Math.abs(a - centro) - Math.abs(b - centro) || a - b);
  let k = 0;
  while (k < indices.length && resto !== 0) {
    const dist = Math.abs(indices[k] - centro);
    const grupo: number[] = [];
    while (k < indices.length && Math.abs(Math.abs(indices[k] - centro) - dist) < 1e-9) grupo.push(indices[k++]);
    const caps = grupo.map((i) => Math.max(0, resto > 0 ? lims[i].max - anchos[i] : anchos[i] - lims[i].min));
    const capTotal = suma(caps.map((c) => (Number.isFinite(c) ? c : 1e12)));
    if (capTotal <= 0) continue;
    const toma = Math.min(Math.abs(resto), capTotal);
    const partes = repartirEntero(
      toma,
      caps.map((c) => (Number.isFinite(c) ? c : 1e12)),
    );
    grupo.forEach((i, j) => (anchos[i] += Math.sign(resto) * partes[j]));
    resto -= Math.sign(resto) * suma(partes);
  }
  return resto;
}

/**
 * Lleva la suma de `anchos` a `total` repartiendo la diferencia en proporción entre
 * los módulos del nivel 1 y, si no alcanza, entre los del nivel 2 (0 = no participa).
 * Devuelve la diferencia que no se pudo repartir (0 si se logró). Modifica `anchos`.
 */
export function ajustarSuma(anchos: number[], lims: Limite[], niveles: number[], total: number): number {
  let delta = Math.round(total - suma(anchos));
  for (const nivel of [1, 2]) {
    if (delta === 0) break;
    const idx = anchos.map((_, i) => i).filter((i) => niveles[i] === nivel);
    if (!idx.length) continue;
    const actual = suma(idx.map((i) => anchos[i]));
    const min = suma(idx.map((i) => lims[i].min));
    const max = suma(idx.map((i) => lims[i].max));
    const objetivo = Math.max(min, Math.min(max, actual + delta));
    const nuevos = repartirConLimites(
      idx.map((i) => anchos[i]),
      objetivo,
      idx.map((i) => lims[i]),
    );
    if (!nuevos) continue;
    idx.forEach((i, j) => (anchos[i] = nuevos[j]));
    delta -= objetivo - actual;
  }
  return delta;
}

/** Holgura total para agrandar (+) o achicar (−) entre los candidatos. */
export function holgura(anchos: number[], lims: Limite[], candidatos: boolean[], signo: 1 | -1): number {
  return anchos.reduce((s, w, i) => (candidatos[i] ? s + Math.max(0, signo > 0 ? lims[i].max - w : w - lims[i].min) : s), 0);
}
