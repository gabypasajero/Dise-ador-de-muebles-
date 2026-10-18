// Traduce los productos de la tienda a plantillas 3D paramétricas.
import type {
  Cuerpo,
  Diseno,
  Encimera,
  Escenario,
  Lavaplatos,
  Plantilla,
  ProductoCatalogo,
  ProductoTienda,
} from './tipos';

let contadorId = 0;
export function nuevoId(prefijo = 'c'): string {
  contadorId += 1;
  return `${prefijo}${Date.now().toString(36)}${contadorId.toString(36)}`;
}

/** Encimera nueva sobre un módulo del tramo principal (o del tramo indicado). */
export function encimera(modulo: string, platos: Encimera['platos'], tramo: Encimera['tramo'] = 'base'): Encimera {
  return { id: nuevoId('e'), tipo: 'encimera', tramo, modulo, platos, campana: false };
}

/** Lavaplatos nuevo con llave, centrado en su módulo. */
export function lavaplatos(modulo: string, modelo: Lavaplatos['modelo'] = 'simple', tramo: Lavaplatos['tramo'] = 'base'): Lavaplatos {
  return { id: nuevoId('e'), tipo: 'lavaplatos', tramo, modulo, modelo, llave: true, posicion: 'centro', margen: 50 };
}

export function cuerpo(parcial: Partial<Cuerpo> & { ancho: number }): Cuerpo {
  return {
    id: nuevoId(),
    tipo: 'frentes',
    puertas: 0,
    bisagra: 'izq',
    cajones: 0,
    columnasCajones: 1,
    altoCajon: 0,
    repisas: 1,
    colgador: false,
    alto: 0,
    ...parcial,
  };
}

/** Lee medidas "P × A × H cm" de la ficha de la tienda (profundidad × ancho × alto). */
export function leerMedidas(texto: string | null): { ancho: number; alto: number; profundidad: number } | null {
  if (!texto) return null;
  const numeros = texto
    .replace(/,/g, '.')
    .split(/[x×X*]/)
    .map((s) => parseFloat(s.replace(/[^\d.]/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (numeros.length !== 3) return null;
  const factor = /mm/i.test(texto) ? 1 : /\bm\b/i.test(texto) && !/cm/i.test(texto) ? 1000 : 10;
  const [profundidad, ancho, alto] = numeros.map((n) => Math.round(n * factor));
  return { ancho, alto, profundidad };
}

function modeloYVariante(nombre: string): { modelo: string; variante: string | null } {
  const [modelo, ...resto] = nombre.split(' · ');
  return {
    modelo: modelo.replace(/\s+personalizable$/i, '').trim(),
    variante: resto.length ? resto.join(' · ').trim() : null,
  };
}

function esInfantil(p: ProductoTienda): boolean {
  return /infantil|beb[eé]|elefante|diseño tem[aá]tico|luna y estrellas/i.test(`${p.nombre} ${p.descripcion ?? ''}`);
}

export function plantillaDe(p: ProductoTienda): Plantilla {
  switch (p.categoria) {
    case 'cocina':
      return /compacto/i.test(p.nombre) ? 'compacto' : 'cocina';
    case 'cocinas-infantiles':
      return 'cocina-infantil';
    case 'closets':
      return 'closet';
    case 'comodas':
      return 'comoda';
    case 'tocadores':
    case 'tocadores-infantiles':
      return 'tocador';
    case 'escritorios':
      return 'escritorio';
    default:
      if (/compacto/i.test(p.nombre)) return 'compacto';
      if (/cocina/i.test(p.nombre)) return 'cocina';
      if (/cl[oó]set/i.test(p.nombre)) return 'closet';
      if (/c[oó]moda/i.test(p.nombre)) return 'comoda';
      if (/tocador/i.test(p.nombre)) return 'tocador';
      return 'comoda';
  }
}

export function escenarioDe(p: ProductoTienda, plantilla: Plantilla): Escenario {
  if (plantilla === 'cocina' || plantilla === 'compacto') return 'cocina';
  if (plantilla === 'cocina-infantil' || plantilla === 'escritorio') return 'infantil';
  if (p.categoria === 'tocadores-infantiles') return 'infantil';
  if (plantilla === 'tocador') return 'dormitorio';
  return esInfantil(p) ? 'infantil' : 'dormitorio';
}

/** Medidas por defecto (mm) cuando la ficha no trae medidas. */
function medidasEstimadas(p: ProductoTienda, plantilla: Plantilla) {
  const n = p.nombre.toLowerCase();
  switch (plantilla) {
    case 'cocina':
      if (/encimera,? 2 puertas y 3 cajones/.test(n)) return { ancho: 1000, alto: 900, profundidad: 550 };
      if (/encimera y 2 puertas/.test(n)) return { ancho: 800, alto: 900, profundidad: 550 };
      return { ancho: 1500, alto: 900, profundidad: 600 };
    case 'compacto':
      if (/5\s*c\b/.test(n)) return { ancho: 1800, alto: 1900, profundidad: 400 };
      return { ancho: 1100, alto: 1920, profundidad: 400 };
    case 'cocina-infantil':
      return { ancho: 900, alto: 1000, profundidad: 300 };
    case 'closet':
      if (/xl|5 puertas/.test(n)) return { ancho: 1800, alto: 1800, profundidad: 450 };
      return { ancho: 1130, alto: 1700, profundidad: 400 };
    case 'comoda':
      if (/13 cajones/.test(n)) return { ancho: 900, alto: 1000, profundidad: 400 };
      if (/mudador/.test(n)) return { ancho: 800, alto: 900, profundidad: 450 };
      return { ancho: 700, alto: 780, profundidad: 370 };
    case 'tocador':
      if (p.categoria === 'tocadores-infantiles') return { ancho: 700, alto: 1250, profundidad: 330 };
      if (/juvenil/.test(n)) return { ancho: 800, alto: 1400, profundidad: 380 };
      if (/mediano/.test(n)) return { ancho: 900, alto: 1450, profundidad: 400 };
      return { ancho: 1100, alto: 1550, profundidad: 420 };
    case 'escritorio':
      if (/set de escritorio/.test(n)) return { ancho: 800, alto: 580, profundidad: 450 };
      return { ancho: 1300, alto: 1700, profundidad: 400 };
  }
}

export function clasificarProducto(p: ProductoTienda): ProductoCatalogo {
  const plantilla = plantillaDe(p);
  const { modelo, variante } = modeloYVariante(p.nombre);
  const leidas = leerMedidas(p.medidas);
  const medidasBase = leidas
    ? { ...leidas, estimadas: false }
    : { ...medidasEstimadas(p, plantilla), estimadas: true };
  return {
    ...p,
    plantilla,
    escenario: escenarioDe(p, plantilla),
    modelo,
    variante,
    medidasBase,
  };
}

/** Busca en el nombre la variante de color de las cocinas (cubierta + melamina). */
export function coloresDeVariante(variante: string | null): { cubierta?: string; frente?: string } {
  if (!variante) return {};
  const v = variante.toLowerCase();
  const out: { cubierta?: string; frente?: string } = {};
  if (v.includes('clasic')) out.cubierta = 'clasic';
  else if (v.includes('calacatta')) out.cubierta = 'calacatta';
  else if (v.includes('florentino')) out.cubierta = 'florentino';
  else if (v.includes('granito beige')) out.cubierta = 'granito-beige';
  else if (v.includes('granito negro')) out.cubierta = 'granito-negro';
  else if (v.includes('granito')) out.cubierta = 'granito';
  if (v.includes('gris blanqueado')) out.frente = 'gris-blanqueado';
  else if (v.includes('pino casina')) out.frente = 'pino-casina';
  else if (v.includes('pino nebraska')) out.frente = 'pino-nebraska';
  else if (v.includes('verde salvia')) out.frente = 'verde-salvia';
  else if (/\brojo\b/.test(v)) out.frente = 'rojo';
  return out;
}

function base(plantilla: Plantilla, medidas: { ancho: number; alto: number; profundidad: number }): Diseno {
  const cocina = plantilla === 'cocina' || plantilla === 'cocina-infantil' || plantilla === 'compacto';
  const adulta = plantilla === 'cocina' || plantilla === 'compacto';
  return {
    version: 2,
    plantilla,
    productoId: null,
    nombreModelo: '',
    ancho: medidas.ancho,
    alto: medidas.alto,
    profundidad: medidas.profundidad,
    cuerpos: [],
    luzFrentes: 3,
    separacionCuerpos: 0,
    zocalo: plantilla === 'compacto' ? 60 : cocina ? 100 : plantilla === 'tocador' ? 0 : 60,
    espesor: 15,
    estructura: plantilla === 'cocina' ? 'modular' : 'unica',
    tirador: adulta ? 'barra' : 'boton',
    materiales: {
      frente: adulta ? 'gris-blanqueado' : 'blanco',
      casco: 'blanco',
      cubierta: adulta ? 'clasic' : 'blanco-liso',
      tirador: adulta ? 'acero' : 'blanco',
    },
    cocina: {
      grifo: 'negro',
      copete: plantilla === 'cocina',
      espesorCubierta: 30,
      vueloCubierta: 25,
    },
    tocador: {
      espejo: 'ovalado',
      luz: 'neutra',
      altoCubierta: 760,
      cajonesIzq: 0,
      cajonesDer: 4,
      cajonesCentro: 1,
      repisasLaterales: true,
    },
    filaSuperior: 0,
    mudador: false,
    imagenFrontal: null,
    aereos: aereosVacios(plantilla),
    lados: { izq: null, der: null },
    equipos: [],
  };
}

/** Mismos valores que reglas.aereosVacios (se repiten aquí para no crear una dependencia circular). */
function aereosVacios(plantilla: Plantilla): Diseno['aereos'] {
  return plantilla === 'compacto'
    ? { activo: true, montaje: 'apoyado', alto: 580, profundidad: 300, elevacion: 880, alineacion: 'centro', cuerpos: [], lados: { izq: null, der: null }, cuadrado: false }
    : { activo: false, montaje: 'mural', alto: 600, profundidad: 300, elevacion: 1450, alineacion: 'centro', cuerpos: [], lados: { izq: null, der: null }, cuadrado: plantilla === 'cocina' };
}

/** Reparte un ancho total en partes proporcionales (enteros que suman exactamente el total). */
export function repartir(total: number, pesos: number[]): number[] {
  const suma = pesos.reduce((a, b) => a + b, 0) || 1;
  const out = pesos.map((p) => Math.round((total * p) / suma));
  const diferencia = total - out.reduce((a, b) => a + b, 0);
  out[out.length - 1] += diferencia;
  return out;
}

function numero(texto: string, patron: RegExp, defecto: number): number {
  const m = texto.match(patron);
  return m ? parseInt(m[1], 10) : defecto;
}

/** Arma el diseño inicial (editable) a partir de un producto de la tienda. */
export function disenoInicial(p: ProductoCatalogo): Diseno {
  const d = base(p.plantilla, p.medidasBase);
  d.productoId = p.id;
  d.nombreModelo = p.modelo;
  const n = p.nombre.toLowerCase();
  const util = d.ancho;

  switch (p.plantilla) {
    case 'cocina': {
      if (/full equipo/.test(n)) {
        // El horno empotrado mide siempre 60 cm: el resto se reparte entre cajones y puerta.
        const a = 600;
        const [b, c] = repartir(util - a, [450, 450]);
        d.cuerpos = [
          cuerpo({ tipo: 'horno', ancho: a }),
          cuerpo({ ancho: b, cajones: 3 }),
          cuerpo({ ancho: c, puertas: 1, bisagra: 'der', repisas: 1 }),
        ];
        d.equipos = [encimera(d.cuerpos[0].id, '4'), lavaplatos(d.cuerpos[2].id)];
      } else if (/lavaplatos/.test(n)) {
        const [a, b] = repartir(util, [1, 2]);
        d.cuerpos = [cuerpo({ ancho: a, cajones: 3 }), cuerpo({ ancho: b, puertas: 2, repisas: 1 })];
        d.equipos = [encimera(d.cuerpos[0].id, '3'), lavaplatos(d.cuerpos[1].id)];
      } else if (/3 cajones/.test(n)) {
        const [a, b] = repartir(util, [2, 3]);
        d.cuerpos = [cuerpo({ ancho: a, cajones: 3 }), cuerpo({ ancho: b, puertas: 2, repisas: 1 })];
        d.equipos = [encimera(d.cuerpos[1].id, '3')];
      } else {
        d.cuerpos = [cuerpo({ ancho: util, puertas: 2, repisas: 1 })];
        d.equipos = [encimera(d.cuerpos[0].id, '3')];
      }
      const colores = coloresDeVariante(p.variante);
      if (colores.cubierta) d.materiales.cubierta = colores.cubierta;
      if (colores.frente) d.materiales.frente = colores.frente;
      break;
    }
    case 'compacto': {
      // Mueble de cocina compacto: base con cubierta postformada y mueble superior apoyado sobre ella.
      if (/5\s*c\b/.test(n)) {
        const [a, b, c] = repartir(util, [740, 370, 690]);
        d.cuerpos = [
          cuerpo({ ancho: a, puertas: 2, repisas: 1 }),
          cuerpo({ ancho: b, cajones: 3 }),
          cuerpo({ ancho: c, puertas: 2, repisas: 1 }),
        ];
        const [s1, s2, s3] = repartir(util, [830, 410, 560]);
        d.aereos.cuerpos = [
          cuerpo({ ancho: s1, puertas: 2, repisas: 1 }),
          cuerpo({ ancho: s2, puertas: 1, bisagra: 'der', repisas: 1 }),
          cuerpo({ tipo: 'nicho', ancho: s3, puertas: 1, abatible: true, repisas: 0 }),
        ];
        d.aereos.alto = 560;
        d.materiales.frente = 'pino-nebraska';
      } else {
        const [a, b] = repartir(util, [600, 500]);
        d.cuerpos = [
          cuerpo({ ancho: a, puertas: 2, repisas: 1 }),
          cuerpo({ ancho: b, cajones: 1, puertas: 1, cajonesArriba: true, bisagra: 'der', repisas: 1 }),
        ];
        d.aereos.cuerpos = [
          cuerpo({ ancho: a, puertas: 2, repisas: 1 }),
          cuerpo({ tipo: 'nicho', ancho: b, puertas: 1, abatible: true, repisas: 0 }),
        ];
        d.materiales.frente = 'verde-salvia';
        d.materiales.cubierta = 'calacatta';
      }
      const colores = coloresDeVariante(p.variante);
      if (colores.cubierta) d.materiales.cubierta = colores.cubierta;
      if (colores.frente) d.materiales.frente = colores.frente;
      break;
    }
    case 'cocina-infantil': {
      const [a, b, c] = repartir(util, [3, 4, 4]);
      d.cuerpos = [
        cuerpo({ ancho: a, puertas: 1, bisagra: 'izq', repisas: 3 }),
        cuerpo({ ancho: b, puertas: 1, bisagra: 'izq', repisas: 1 }),
        cuerpo({ tipo: 'horno', ancho: c }),
      ];
      d.zocalo = 40;
      d.tirador = 'boton';
      d.materiales.frente = 'blanco';
      d.materiales.cubierta = 'blanco-liso';
      d.equipos = [encimera(d.cuerpos[2].id, '2'), { ...lavaplatos(d.cuerpos[1].id), llave: false }];
      d.cocina.grifo = 'cromado';
      d.cocina.copete = false;
      d.cocina.espesorCubierta = 18;
      d.cocina.vueloCubierta = 10;
      break;
    }
    case 'closet': {
      const puertas = numero(n, /(\d+)\s*puertas/, 2);
      const cajones = numero(n, /(\d+)\s*cajones/, 4);
      if (puertas === 2) {
        d.cuerpos = [cuerpo({ ancho: util, puertas: 2, cajones, colgador: true, repisas: 1 })];
      } else if (puertas === 3 && cajones >= 8) {
        d.cuerpos = [
          cuerpo({ ancho: util, puertas: 3, cajones, columnasCajones: 2, colgador: true, repisas: 1 }),
        ];
      } else if (puertas === 3) {
        const [a, b] = repartir(util, [1, 1.8]);
        d.cuerpos = [
          cuerpo({ ancho: a, puertas: 1, bisagra: 'izq', repisas: 4 }),
          cuerpo({ ancho: b, puertas: 2, cajones, colgador: true, repisas: 1 }),
        ];
      } else if (puertas === 4) {
        const [a, b, c] = repartir(util, [1, 2, 1]);
        d.cuerpos = [
          cuerpo({ ancho: a, puertas: 1, bisagra: 'izq', repisas: 4 }),
          cuerpo({ ancho: b, puertas: 2, cajones, colgador: true, repisas: 1 }),
          cuerpo({ ancho: c, puertas: 1, bisagra: 'der', repisas: 4 }),
        ];
      } else {
        const [a, b, c, e] = repartir(util, [1, 1.6, 1, 1]);
        d.cuerpos = [
          cuerpo({ ancho: a, puertas: 1, bisagra: 'izq', repisas: 4 }),
          cuerpo({ ancho: b, puertas: 2, cajones, colgador: true, repisas: 1 }),
          cuerpo({ ancho: c, puertas: 1, bisagra: 'der', colgador: true, repisas: 1 }),
          cuerpo({ ancho: e, puertas: 1, bisagra: 'der', repisas: 4 }),
        ];
      }
      break;
    }
    case 'comoda': {
      if (/13 cajones/.test(n)) {
        const [a, b] = repartir(util, [1, 1]);
        d.filaSuperior = 3;
        d.cuerpos = [cuerpo({ ancho: a, cajones: 5 }), cuerpo({ ancho: b, cajones: 5 })];
      } else {
        const cajones = numero(n, /(\d+)\s*cajones/, 4);
        d.cuerpos = [cuerpo({ ancho: util, cajones })];
        if (/mudador/.test(n)) d.mudador = true;
      }
      break;
    }
    case 'tocador': {
      const cajones = numero(n, /(\d+)\s*cajones/, p.categoria === 'tocadores-infantiles' ? 3 : 5);
      d.cuerpos = [cuerpo({ ancho: util })];
      const centro = cajones >= 7 ? 2 : 1;
      const resto = Math.max(0, cajones - centro);
      d.tocador.cajonesCentro = /juvenil/.test(n) ? 2 : centro;
      d.tocador.cajonesIzq = /juvenil/.test(n) ? 0 : resto > 4 ? Math.floor(resto / 2) : 0;
      d.tocador.cajonesDer = /juvenil/.test(n) ? 0 : resto - d.tocador.cajonesIzq;
      d.tocador.espejo = /hollywood|foco/.test(n) ? 'hollywood' : /ovalado|led/.test(`${n} ${(p.descripcion ?? '').toLowerCase()}`) ? 'ovalado' : 'rectangular';
      if (/ovalado/.test((p.descripcion ?? '').toLowerCase())) d.tocador.espejo = 'ovalado';
      if (p.categoria === 'tocadores-infantiles') {
        d.tocador.altoCubierta = 560;
        d.tocador.cajonesIzq = 0;
        d.tocador.cajonesDer = 2;
        d.tocador.cajonesCentro = 1;
        d.materiales.frente = 'rosa-palo';
      }
      d.tirador = 'boton';
      d.materiales.tirador = 'cromado';
      break;
    }
    case 'escritorio': {
      if (/set de escritorio/.test(n)) {
        const [a, b] = repartir(util, [2, 1]);
        d.cuerpos = [cuerpo({ tipo: 'escritorio', ancho: a }), cuerpo({ ancho: b, cajones: 2 })];
      } else {
        const [a, b, c] = repartir(util, [450, 400, 450]);
        d.cuerpos = [
          cuerpo({ tipo: 'escritorio', ancho: a, alto: 750 }),
          cuerpo({ ancho: b, cajones: 3, altoCajon: 230, repisas: 2 }),
          cuerpo({ ancho: c, puertas: 1, bisagra: 'der', colgador: true, repisas: 2 }),
        ];
      }
      break;
    }
  }
  return d;
}

/** Diseño en blanco para empezar sin un producto de la tienda. */
export function disenoLibre(plantilla: Plantilla): Diseno {
  const falso: ProductoTienda = {
    id: 0,
    nombre:
      plantilla === 'cocina'
        ? 'Cocina full equipo'
        : plantilla === 'compacto'
          ? 'Mueble de cocina compacto 3C'
          : plantilla === 'closet'
          ? 'Clóset 4 puertas 4 cajones'
          : plantilla === 'comoda'
            ? 'Cómoda 4 cajones'
            : plantilla === 'tocador'
              ? 'Tocador 5 cajones espejo LED'
              : plantilla === 'escritorio'
                ? 'Clóset escritorio'
                : 'Cocina infantil',
    categoria:
      plantilla === 'cocina' || plantilla === 'compacto'
        ? 'cocina'
        : plantilla === 'closet'
          ? 'closets'
          : plantilla === 'comoda'
            ? 'comodas'
            : plantilla === 'tocador'
              ? 'tocadores'
              : plantilla === 'escritorio'
                ? 'escritorios'
                : 'cocinas-infantiles',
    descripcion: null,
    medidas: null,
    precio: 0,
    precio_oferta: null,
    imagen_url: null,
    personalizable: true,
    destacado: false,
    orden: null,
  };
  const d = disenoInicial(clasificarProducto(falso));
  d.productoId = null;
  return d;
}

export const NOMBRE_PLANTILLA: Record<Plantilla, string> = {
  cocina: 'Mueble de cocina',
  compacto: 'Cocina compacta',
  closet: 'Clóset',
  comoda: 'Cómoda',
  tocador: 'Tocador',
  escritorio: 'Clóset escritorio',
  'cocina-infantil': 'Cocina infantil',
};

export const NOMBRE_ESCENARIO: Record<Escenario, string> = {
  cocina: 'Cocina',
  dormitorio: 'Dormitorio',
  infantil: 'Dormitorio infantil',
  estudio: 'Estudio neutro',
};
