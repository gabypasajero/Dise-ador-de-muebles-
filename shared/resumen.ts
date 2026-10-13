// Detalle de la cotización en forma de lista y su versión en texto
// (para copiar o enviar al cliente por WhatsApp).
import { calcularLayout } from './layout';
import { formatear, formatoPrecio } from './reglas';
import type { CatalogoMateriales, Cotizacion, Diseno, LineaDetalle, ProductoCatalogo, Unidad } from './tipos';

function nombreMaterial(lista: { id: string; nombre: string }[] | undefined, id: string) {
  return lista?.find((m) => m.id === id)?.nombre ?? id;
}

const TIRADOR: Record<Diseno['tirador'], string> = {
  barra: 'barra',
  boton: 'botón',
  unero: 'perfil uñero',
  sin: 'sin tirador (apertura por presión)',
};

export function describirCuerpos(d: Diseno, unidad: Unidad): string[] {
  if (d.plantilla === 'tocador') {
    const t = d.tocador;
    return [
      `Cajonera izquierda: ${t.cajonesIzq} cajones`,
      `Centro: ${t.cajonesCentro} cajones`,
      `Cajonera derecha: ${t.cajonesDer} cajones`,
      `Espejo ${t.espejo === 'ovalado' ? 'ovalado LED' : t.espejo === 'hollywood' ? 'Hollywood' : 'rectangular LED'}, luz ${t.luz}`,
    ];
  }
  const l = calcularLayout(d);
  return d.cuerpos.map((c, i) => {
    const ancho = formatear(c.ancho, unidad);
    if (c.tipo === 'horno') return `Módulo ${i + 1} (${ancho}): ${d.plantilla === 'cocina-infantil' ? 'horno de juguete' : 'horno empotrado'}`;
    if (c.tipo === 'hueco') return `Módulo ${i + 1} (${ancho}): espacio libre`;
    if (c.tipo === 'escritorio') return `Módulo ${i + 1} (${ancho}): escritorio de ${formatear(c.alto || 750, unidad)} de alto`;
    const partes: string[] = [];
    const puertas = l.frentes.filter((f) => f.tipo === 'puerta' && f.cuerpo === i);
    const cajones = l.frentes.filter((f) => f.tipo === 'cajon' && f.cuerpo === i);
    if (puertas.length) {
      const p = puertas[0].rect;
      partes.push(`${puertas.length} ${puertas.length === 1 ? 'puerta' : 'puertas'} de ${formatear(p.x1 - p.x0, unidad, false)} × ${formatear(p.y1 - p.y0, unidad)}`);
    }
    if (cajones.length) partes.push(`${cajones.length} ${cajones.length === 1 ? 'cajón' : 'cajones'}`);
    if (c.colgador) partes.push('barra para colgar');
    if (!puertas.length && !cajones.length) partes.push(`abierto con ${c.repisas} repisas`);
    return `Módulo ${i + 1} (${ancho}): ${partes.join(', ')}`;
  });
}

/** Datos técnicos del mueble diseñado, en el orden en que se muestran en la cotización. */
export function detalleCotizacion(
  d: Diseno,
  producto: ProductoCatalogo | null,
  unidad: Unidad,
  materiales: CatalogoMateriales | null,
): LineaDetalle[] {
  const lineas: LineaDetalle[] = [];
  const m = d.materiales;
  const cocina = d.plantilla === 'cocina' || d.plantilla === 'cocina-infantil';
  lineas.push({
    etiqueta: 'Modelo base',
    valor: producto ? `${producto.nombre} (código ${producto.id})` : d.nombreModelo || 'Diseño a medida',
  });
  lineas.push({
    etiqueta: 'Medidas',
    valor: `${formatear(d.ancho, unidad, false)} × ${formatear(d.alto, unidad, false)} × ${formatear(d.profundidad, unidad)} (ancho × alto × profundidad)`,
  });
  lineas.push({ etiqueta: 'Distribución', valor: d.plantilla === 'tocador' ? 'Tocador' : `${d.cuerpos.length} ${d.cuerpos.length === 1 ? 'módulo' : 'módulos'}`, sub: describirCuerpos(d, unidad) });
  lineas.push({ etiqueta: 'Melamina frentes', valor: nombreMaterial(materiales?.melaminas, m.frente) });
  lineas.push({ etiqueta: 'Melamina cuerpo', valor: nombreMaterial(materiales?.melaminas, m.casco) });
  if (cocina) lineas.push({ etiqueta: 'Cubierta postformada', valor: nombreMaterial(materiales?.cubiertas, m.cubierta) });
  lineas.push({
    etiqueta: 'Tiradores',
    valor: d.tirador === 'sin' ? TIRADOR.sin : `${TIRADOR[d.tirador]} ${nombreMaterial(materiales?.tiradores, m.tirador).toLowerCase()}`,
  });
  if (cocina) {
    const k = d.cocina;
    const eq: string[] = [];
    if (k.encimera !== 'ninguna') eq.push(`encimera ${k.encimera} platos (módulo ${k.encimeraCuerpo + 1})`);
    if (k.lavaplatos !== 'ninguno') {
      eq.push(`lavaplatos ${k.lavaplatos === 'doble' ? '2 cubetas' : '1 cubeta'} (módulo ${k.lavaplatosCuerpo + 1}), grifería ${k.grifo === 'negro' ? 'negro mate' : 'cromada'}`);
    }
    if (d.plantilla === 'cocina') eq.push(`cubierta ${k.espesorCubierta} mm${k.copete ? ' con copete' : ''}`);
    if (eq.length) lineas.push({ etiqueta: 'Equipamiento', valor: eq.join('; ') });
  }
  lineas.push({
    etiqueta: 'Espacios',
    valor: `separación entre módulos ${formatear(d.separacionCuerpos, unidad)}, zócalo ${formatear(d.zocalo, unidad)}, luz entre frentes ${d.luzFrentes} mm, melamina ${d.espesor} mm`,
  });
  const extras: string[] = [];
  if (d.plantilla === 'comoda' && d.mudador) extras.push('mudador');
  if (d.imagenFrontal) extras.push('imagen personalizada impresa en los frentes');
  if (extras.length) lineas.push({ etiqueta: 'Extras', valor: extras.join(', ') });
  return lineas;
}

export function numeroCotizacion(id: number): string {
  return `COT-${String(id).padStart(4, '0')}`;
}

/** AAAA-MM-DD → DD-MM-AAAA */
export function formatoFecha(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return a && m && d ? `${d}-${m}-${a}` : iso;
}

/** Fecha local de hoy en formato AAAA-MM-DD. */
export function hoy(): string {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

/** Texto plano de la cotización: título, datos en lista y cierre con vendedor, fecha y valor. */
export function textoCotizacion(c: Pick<Cotizacion, 'numero' | 'cliente' | 'detalle' | 'observaciones' | 'vendedor' | 'fecha' | 'valor'>): string {
  const lineas: string[] = [];
  lineas.push(`Cotización ${c.cliente.nombre} · N° ${c.numero}`);
  lineas.push('De Todito Outlet · Muebles a medida');
  lineas.push('');
  lineas.push(`• Cliente: ${c.cliente.nombre}`);
  if (c.cliente.telefono) lineas.push(`• Teléfono: ${c.cliente.telefono}`);
  if (c.cliente.email) lineas.push(`• Correo: ${c.cliente.email}`);
  if (c.cliente.direccion) lineas.push(`• Dirección / comuna: ${c.cliente.direccion}`);
  for (const l of c.detalle) {
    lineas.push(`• ${l.etiqueta}: ${l.valor}`);
    for (const s of l.sub ?? []) lineas.push(`   - ${s}`);
  }
  if (c.observaciones) lineas.push(`• Observaciones: ${c.observaciones}`);
  lineas.push('');
  lineas.push(`Vendedor: ${c.vendedor.nombre}`);
  lineas.push(`Fecha cotización: ${formatoFecha(c.fecha)}`);
  lineas.push(`Valor mueble: ${formatoPrecio(c.valor)}`);
  return lineas.join('\n');
}

/** Normaliza un teléfono chileno para wa.me (solo dígitos, con código 56). */
export function telefonoWhatsapp(telefono: string | null): string | null {
  if (!telefono) return null;
  let n = telefono.replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 9 && n.startsWith('9')) n = `56${n}`;
  if (n.length === 8) n = `569${n}`;
  return n.length >= 10 ? n : null;
}
