// Texto de resumen del diseño para cotizar por WhatsApp.
import { calcularLayout } from './layout';
import { formatear, formatoPrecio } from './reglas';
import type { CatalogoMateriales, Diseno, ProductoCatalogo, Unidad } from './tipos';

function nombreMaterial(lista: { id: string; nombre: string }[] | undefined, id: string) {
  return lista?.find((m) => m.id === id)?.nombre ?? id;
}

const TIRADOR: Record<Diseno['tirador'], string> = {
  barra: 'barra',
  boton: 'botón',
  unero: 'perfil uñero',
  sin: 'sin tirador (push)',
};

export function describirCuerpos(d: Diseno, unidad: Unidad): string[] {
  if (d.plantilla === 'tocador') {
    const t = d.tocador;
    return [
      `Cajonera izquierda: ${t.cajonesIzq} cajones`,
      `Centro: ${t.cajonesCentro} cajones`,
      `Cajonera derecha: ${t.cajonesDer} cajones`,
      `Espejo ${t.espejo === 'ovalado' ? 'ovalado LED' : t.espejo === 'hollywood' ? 'Hollywood' : 'rectangular LED'} (luz ${t.luz})`,
    ];
  }
  const l = calcularLayout(d);
  return d.cuerpos.map((c, i) => {
    const ancho = formatear(c.ancho, unidad);
    if (c.tipo === 'horno') return `${i + 1}) Horno empotrado · ${ancho}`;
    if (c.tipo === 'hueco') return `${i + 1}) Espacio libre · ${ancho}`;
    if (c.tipo === 'escritorio') return `${i + 1}) Escritorio · ${ancho} · alto ${formatear(c.alto || 750, unidad)}`;
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
    return `${i + 1}) ${ancho}: ${partes.join(', ')}`;
  });
}

export function resumenDiseno(
  d: Diseno,
  producto: ProductoCatalogo | null,
  unidad: Unidad,
  materiales: CatalogoMateriales | null,
  precio: number | null,
): string {
  const lineas: string[] = [];
  lineas.push('Hola Rachel, diseñé un mueble a medida en el diseñador 3D:');
  lineas.push(`• Modelo base: ${producto ? `${producto.nombre} (código ${producto.id})` : d.nombreModelo || 'diseño libre'}`);
  lineas.push(
    `• Medidas: ${formatear(d.ancho, unidad, false)} × ${formatear(d.alto, unidad, false)} × ${formatear(d.profundidad, unidad)} (ancho × alto × profundidad)`,
  );
  lineas.push('• Distribución:');
  for (const c of describirCuerpos(d, unidad)) lineas.push(`   ${c}`);
  const m = d.materiales;
  let colores = `• Melamina frentes: ${nombreMaterial(materiales?.melaminas, m.frente)} · cuerpo: ${nombreMaterial(materiales?.melaminas, m.casco)}`;
  if (d.plantilla === 'cocina' || d.plantilla === 'cocina-infantil') colores += ` · cubierta postformada: ${nombreMaterial(materiales?.cubiertas, m.cubierta)}`;
  lineas.push(colores);
  if (d.tirador !== 'sin') lineas.push(`• Tiradores: ${TIRADOR[d.tirador]} ${nombreMaterial(materiales?.tiradores, m.tirador).toLowerCase()}`);
  else lineas.push(`• Tiradores: ${TIRADOR.sin}`);
  if (d.plantilla === 'cocina' || d.plantilla === 'cocina-infantil') {
    const k = d.cocina;
    const eq: string[] = [];
    if (k.encimera !== 'ninguna') eq.push(`encimera ${k.encimera} platos (cuerpo ${k.encimeraCuerpo + 1})`);
    if (k.lavaplatos !== 'ninguno') eq.push(`lavaplatos ${k.lavaplatos === 'doble' ? '2 cubetas' : '1 cubeta'} (cuerpo ${k.lavaplatosCuerpo + 1}), grifería ${k.grifo === 'negro' ? 'negro mate' : 'cromada'}`);
    if (d.plantilla === 'cocina') eq.push(`cubierta ${k.espesorCubierta} mm${k.copete ? ' con copete' : ''}`);
    if (eq.length) lineas.push(`• Equipamiento: ${eq.join(', ')}`);
  }
  lineas.push(
    `• Espacios: separación entre cuerpos ${formatear(d.separacionCuerpos, unidad)}, zócalo ${formatear(d.zocalo, unidad)}, luz entre frentes ${d.luzFrentes} mm, melamina ${d.espesor} mm`,
  );
  if (d.plantilla === 'comoda' && d.mudador) lineas.push('• Con mudador');
  if (d.imagenFrontal) lineas.push('• Con imagen personalizada en los frentes (te la envío por aquí)');
  if (precio) lineas.push(`• Precio referencial del diseñador: ${formatoPrecio(precio)}`);
  return lineas.join('\n');
}
