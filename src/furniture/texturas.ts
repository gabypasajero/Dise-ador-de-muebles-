// Texturas procedurales (se dibujan en un canvas) para melaminas, cubiertas y
// el escenario. Son repetibles sin costuras y se cachean por clave.
import * as THREE from 'three';
import type { Material } from '../../shared/tipos';

// ---------- Ruido repetible ----------

function hash(x: number, y: number, semilla: number): number {
  let h = (x * 374761393 + y * 668265263 + semilla * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function suave(t: number) {
  return t * t * (3 - 2 * t);
}

/** Ruido de valor periódico: se repite cada `px` × `py` celdas. */
function ruido(x: number, y: number, px: number, py: number, semilla: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = suave(x - x0);
  const fy = suave(y - y0);
  const m = (v: number, p: number) => ((v % p) + p) % p;
  const a = hash(m(x0, px), m(y0, py), semilla);
  const b = hash(m(x0 + 1, px), m(y0, py), semilla);
  const c = hash(m(x0, px), m(y0 + 1, py), semilla);
  const d = hash(m(x0 + 1, px), m(y0 + 1, py), semilla);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Ruido fractal periódico en [0,1]. u,v en [0,1); frecuencias enteras para que repita. */
function fbm(u: number, v: number, fu: number, fv: number, octavas: number, semilla: number): number {
  let suma = 0;
  let amp = 0.5;
  let total = 0;
  for (let o = 0; o < octavas; o++) {
    suma += amp * ruido(u * fu, v * fv, fu, fv, semilla + o * 17);
    total += amp;
    fu *= 2;
    fv *= 2;
    amp *= 0.5;
  }
  return suma / total;
}

function rgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  // Trabajamos en sRGB para dibujar en el canvas.
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

function mezclar(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function lienzo(tam: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = tam;
  c.height = tam;
  return [c, c.getContext('2d')!];
}

function pintarPixeles(tam: number, f: (u: number, v: number) => [number, number, number]): HTMLCanvasElement {
  const [c, ctx] = lienzo(tam);
  const img = ctx.createImageData(tam, tam);
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const [r, g, b] = f(x / tam, y / tam);
      const i = (y * tam + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- Generadores de superficie ----------

/** Veta de madera (melamina) que corre a lo largo del eje vertical de la imagen. */
export function lienzoMadera(base: string, veta: string, tam = 768, semilla = 7): HTMLCanvasElement {
  const cb = rgb(base);
  const cv = rgb(veta);
  const claro = mezclar(cb, [255, 255, 255], 0.55);
  return pintarPixeles(tam, (u, v) => {
    // Leve ondulación lateral de la veta (todas las frecuencias son enteras para que repita).
    const desvio = 0.006 * (fbm(u, v, 2, 3, 2, semilla) - 0.5) + 0.0025 * Math.sin(v * Math.PI * 6 + u * Math.PI * 4);
    const x = u + desvio;
    // Franjas largas de tono, como las tablas del tablero.
    const tono = fbm(x, v, 7, 1, 2, semilla + 1);
    // Líneas finas de veta.
    const fase = x * 46 + 0.9 * fbm(x, v, 3, 2, 2, semilla + 3);
    const anillo = fase - Math.floor(fase);
    const linea = Math.pow(Math.max(0, 1 - Math.abs(anillo - 0.5) * 2), 9);
    // Fibras muy finas.
    const fibra = fbm(x, v, 230, 3, 2, semilla + 9);
    const peso = 0.2 * linea + 0.36 * (tono - 0.5) + 0.3 * (fibra - 0.5);
    return peso >= 0 ? mezclar(cb, cv, Math.min(1, peso * 1.35)) : mezclar(cb, claro, Math.min(1, -peso * 0.9));
  });
}

export function lienzoMarmol(base: string, veta: string, tam = 1024, semilla = 11): HTMLCanvasElement {
  const cb = rgb(base);
  const cv = rgb(veta);
  const oscuroFondo = mezclar(cb, cv, 0.12);
  return pintarPixeles(tam, (u, v) => {
    const turb = fbm(u, v, 3, 3, 5, semilla);
    const t = u * 2 + v * 4 + turb * 5.5;
    const linea = Math.abs(Math.sin(t * Math.PI));
    const vena = 1 - Math.min(1, linea / 0.07);
    const t2 = u * 4 - v * 2 + fbm(u, v, 4, 4, 4, semilla + 5) * 6;
    const vena2 = 1 - Math.min(1, Math.abs(Math.sin(t2 * Math.PI)) / 0.035);
    const nube = fbm(u, v, 5, 5, 4, semilla + 13);
    let col = mezclar(cb, oscuroFondo, nube * 0.7);
    col = mezclar(col, cv, Math.max(vena * 0.85, vena2 * 0.45));
    return col;
  });
}

export function lienzoConcreto(base: string, tam = 512, semilla = 3): HTMLCanvasElement {
  const cb = rgb(base);
  const oscuro = mezclar(cb, [0, 0, 0], 0.18);
  const claro = mezclar(cb, [255, 255, 255], 0.12);
  return pintarPixeles(tam, (u, v) => {
    const n = fbm(u, v, 6, 6, 5, semilla);
    const poro = hash(Math.floor(u * tam), Math.floor(v * tam), semilla) > 0.995 ? 0.5 : 0;
    const col = n > 0.5 ? mezclar(cb, claro, (n - 0.5) * 1.4) : mezclar(cb, oscuro, (0.5 - n) * 1.4);
    return mezclar(col, oscuro, poro);
  });
}

export function lienzoGranito(base: string, motas: string[], tam = 1024, semilla = 5): HTMLCanvasElement {
  const [fondo, ctx] = lienzo(tam);
  ctx.drawImage(lienzoConcreto(base, Math.min(256, tam), semilla), 0, 0, tam, tam);
  let s = semilla * 9301;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const cantidad = Math.round(tam * tam * 0.012);
  for (let i = 0; i < cantidad; i++) {
    const x = rnd() * tam;
    const y = rnd() * tam;
    const r = 0.6 + Math.pow(rnd(), 3) * 5.5;
    ctx.fillStyle = motas[Math.floor(rnd() * motas.length)];
    ctx.globalAlpha = 0.55 + rnd() * 0.45;
    // Se dibuja también desplazado para que la textura repita sin cortes.
    for (const dx of [-tam, 0, tam]) {
      for (const dy of [-tam, 0, tam]) {
        if (x + dx < -r || x + dx > tam + r || y + dy < -r || y + dy > tam + r) continue;
        ctx.beginPath();
        const lados = 5 + Math.floor(rnd() * 3);
        for (let k = 0; k < lados; k++) {
          const a = (k / lados) * Math.PI * 2;
          const rr = r * (0.7 + rnd() * 0.5);
          const px = x + dx + Math.cos(a) * rr;
          const py = y + dy + Math.sin(a) * rr;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  return fondo;
}

export function lienzoLiso(base: string, tam = 256, semilla = 1): HTMLCanvasElement {
  // Un liso con micro variación para que no se vea plástico.
  const cb = rgb(base);
  return pintarPixeles(tam, (u, v) => {
    const n = (fbm(u, v, 16, 16, 2, semilla) - 0.5) * 0.035;
    return mezclar(cb, n > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(n));
  });
}

// ---------- Texturas para Three.js ----------

const cache = new Map<string, THREE.Texture>();

function aTextura(canvas: HTMLCanvasElement, tamMm: number, color = true): THREE.Texture {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  // Las geometrías usan UV en milímetros: una repetición cada tamMm.
  t.repeat.set(1 / tamMm, 1 / tamMm);
  t.needsUpdate = true;
  return t;
}

/** Tamaño real (mm) que cubre una repetición de la textura. */
export function tamanoTextura(m: Material): number {
  switch (m.tipo) {
    case 'madera':
      return 1100;
    case 'marmol':
      return 1500;
    case 'granito':
      return 700;
    case 'concreto':
      return 900;
    default:
      return 600;
  }
}

export function lienzoMaterial(m: Material, tam?: number): HTMLCanvasElement {
  switch (m.tipo) {
    case 'madera':
      return lienzoMadera(m.color, m.veta ?? m.color, tam ?? 768, semillaDe(m.id));
    case 'marmol':
      return lienzoMarmol(m.color, m.veta ?? '#999999', tam ?? 768, semillaDe(m.id));
    case 'granito':
      return lienzoGranito(m.color, m.motas ?? ['#333333', '#eeeeee'], tam ?? 1024, semillaDe(m.id));
    case 'concreto':
      return lienzoConcreto(m.color, tam ?? 512, semillaDe(m.id));
    default:
      return lienzoLiso(m.color, tam ?? 256, semillaDe(m.id));
  }
}

function semillaDe(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h % 1000) + 1;
}

/**
 * Textura fotográfica (colores oficiales). Mientras la imagen carga, o si falla, se ve el
 * color promedio del material en vez de una superficie negra.
 */
function texturaFoto(url: string, color: string, tamMm: number): THREE.Texture {
  const [c, ctx] = lienzo(1024);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  const t = aTextura(c, tamMm);
  new THREE.ImageLoader().load(
    url,
    (img) => {
      // three.js no puede cambiar el tamaño de una textura ya subida a la GPU: se libera antes.
      if (img.width !== c.width || img.height !== c.height) t.dispose();
      t.image = img;
      t.needsUpdate = true;
    },
    undefined,
    () => console.warn(`[texturas] no se pudo cargar ${url}; se usa el color promedio`),
  );
  return t;
}

export function texturaMaterial(m: Material): THREE.Texture {
  // Escala real: tamanoMm es lo que mide (en mm) una repetición de la textura fotográfica.
  const tamMm = m.tamanoMm ?? tamanoTextura(m);
  const clave = `mat:${m.id}:${m.tipo}:${m.color}:${m.veta ?? ''}:${m.textura ?? ''}:${tamMm}`;
  let t = cache.get(clave);
  if (!t) {
    t = m.textura ? texturaFoto(m.textura, m.color, tamMm) : aTextura(lienzoMaterial(m), tamMm);
    cache.set(clave, t);
  }
  return t;
}

/** Muestra pequeña para los selectores de color (data URL). */
const cacheMuestras = new Map<string, string>();
export function muestraMaterial(m: Material): string {
  const clave = `${m.id}:${m.color}:${m.veta ?? ''}`;
  let url = cacheMuestras.get(clave);
  if (!url) {
    if (m.textura) {
      url = m.textura;
    } else {
      const grande = lienzoMaterial(m, m.tipo === 'liso' ? 64 : 256);
      const [c, ctx] = lienzo(96);
      ctx.drawImage(grande, 0, 0, grande.width * (m.tipo === 'madera' ? 0.35 : 0.5), grande.height * 0.5, 0, 0, 96, 96);
      url = c.toDataURL('image/jpeg', 0.85);
    }
    cacheMuestras.set(clave, url);
  }
  return url;
}

// ---------- Texturas del escenario ----------

function cacheada(clave: string, crear: () => THREE.Texture): THREE.Texture {
  let t = cache.get(clave);
  if (!t) {
    t = crear();
    cache.set(clave, t);
  }
  return t;
}

/** Porcelanato en baldosas cuadradas con fragüe. */
export function texturaBaldosas(base: string, fragua: string, piezas = 2, tamMm = 1200): THREE.Texture {
  return cacheada(`baldosa:${base}:${fragua}:${piezas}`, () => {
    const tam = 1024;
    const marmol = lienzoMarmol(base, mezclarHex(base, '#000000', 0.12), tam, 31);
    const ctx = marmol.getContext('2d')!;
    ctx.fillStyle = fragua;
    const paso = tam / piezas;
    const grosor = Math.max(2, tam / 260);
    for (let i = 0; i <= piezas; i++) {
      ctx.fillRect(i * paso - grosor / 2, 0, grosor, tam);
      ctx.fillRect(0, i * paso - grosor / 2, tam, grosor);
    }
    return aTextura(marmol, tamMm);
  });
}

/** Azulejo tipo metro (subway) para el salpicadero de la cocina. */
export function texturaAzulejo(base: string, fragua: string): THREE.Texture {
  return cacheada(`azulejo:${base}:${fragua}`, () => {
    const tam = 1024;
    const [c, ctx] = lienzo(tam);
    const filas = 8;
    const cols = 4;
    const h = tam / filas;
    const w = tam / cols;
    ctx.fillStyle = fragua;
    ctx.fillRect(0, 0, tam, tam);
    const cb = rgb(base);
    for (let r = 0; r < filas; r++) {
      const desfase = r % 2 ? w / 2 : 0;
      for (let k = -1; k <= cols; k++) {
        const x = k * w + desfase;
        const variacion = (hash(k, r, 3) - 0.5) * 10;
        const grad = ctx.createLinearGradient(x, r * h, x, r * h + h);
        const col = `rgb(${cb[0] + variacion},${cb[1] + variacion},${cb[2] + variacion})`;
        grad.addColorStop(0, `rgb(${cb[0] + 6 + variacion},${cb[1] + 6 + variacion},${cb[2] + 6 + variacion})`);
        grad.addColorStop(1, col);
        ctx.fillStyle = grad;
        ctx.fillRect(x + 3, r * h + 3, w - 6, h - 6);
      }
    }
    // 600 mm de alto cubren 8 filas de 75 mm.
    return aTextura(c, 600);
  });
}

/** Piso de madera en tablas. */
export function texturaParquet(base: string, veta: string): THREE.Texture {
  return cacheada(`parquet:${base}:${veta}`, () => {
    const tam = 1024;
    const madera = lienzoMadera(base, veta, tam, 41);
    const ctx = madera.getContext('2d')!;
    const tablas = 6;
    const w = tam / tablas;
    for (let i = 0; i < tablas; i++) {
      // Variación de tono por tabla.
      ctx.fillStyle = hash(i, 1, 9) > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(i * w, 0, w, tam);
      ctx.fillStyle = 'rgba(40,25,15,0.55)';
      ctx.fillRect(i * w, 0, 2, tam);
      const corte = hash(i, 7, 5) * tam;
      ctx.fillRect(i * w, corte, w, 2);
    }
    return aTextura(madera, 1100);
  });
}

/** Pintura de muro: casi lisa, con una textura muy suave. */
export function texturaPared(base: string): THREE.Texture {
  return cacheada(`pared:${base}`, () => {
    const cb = rgb(base);
    const c = pintarPixeles(256, (u, v) => {
      const n = (fbm(u, v, 8, 8, 3, 77) - 0.5) * 0.06 + (hash(Math.floor(u * 256), Math.floor(v * 256), 3) - 0.5) * 0.025;
      return mezclar(cb, n > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(n));
    });
    return aTextura(c, 800);
  });
}

/** Alfombra con bordes y patrón geométrico suave. */
export function texturaAlfombra(fondo: string, dibujo: string, borde: string): THREE.Texture {
  return cacheada(`alfombra:${fondo}:${dibujo}:${borde}`, () => {
    const tam = 512;
    const c = pintarPixeles(tam, (u, v) => {
      const n = fbm(u, v, 64, 64, 2, 4) * 0.12;
      const marco = u < 0.06 || u > 0.94 || v < 0.06 || v > 0.94;
      const linea = Math.abs(u - 0.1) < 0.01 || Math.abs(u - 0.9) < 0.01 || Math.abs(v - 0.1) < 0.01 || Math.abs(v - 0.9) < 0.01;
      const rombo = Math.abs(((u * 6) % 1) - 0.5) + Math.abs(((v * 6) % 1) - 0.5) < 0.18;
      const col = marco || linea ? rgb(borde) : rombo ? rgb(dibujo) : rgb(fondo);
      return mezclar(col, [255, 255, 255], n);
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

function mezclarHex(a: string, b: string, t: number): string {
  const c = new THREE.Color(a).lerp(new THREE.Color(b), t);
  return `#${c.getHexString()}`;
}

/** Textura de una imagen subida por el cliente (para los frentes). */
export function texturaImagen(url: string): THREE.Texture {
  return cacheada(`img:${url.length}:${url.slice(-64)}`, () => {
    const t = new THREE.TextureLoader().load(url, (cargada) => {
      const img = cargada.image as { width: number; height: number };
      cargada.userData.aspecto = img.width / img.height;
      (cargada.userData.alCargar as (() => void) | undefined)?.();
    });
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

/**
 * Recorta la imagen para que cubra el área de frentes sin deformarse
 * (como "cover" en CSS). Se vuelve a aplicar cuando la imagen termina de cargar.
 */
export function ajustarImagenFrentes(material: THREE.Material | null, ancho: number, alto: number) {
  const tex = (material as THREE.MeshStandardMaterial | null)?.map;
  if (!tex) return;
  const aplicar = () => {
    const ai = tex.userData.aspecto as number | undefined;
    if (!ai || ancho <= 0 || alto <= 0) return;
    const af = ancho / alto;
    if (ai > af) {
      tex.repeat.set(af / ai, 1);
      tex.offset.set((1 - af / ai) / 2, 0);
    } else {
      tex.repeat.set(1, ai / af);
      tex.offset.set(0, (1 - ai / af) / 2);
    }
  };
  tex.userData.alCargar = aplicar;
  aplicar();
}
