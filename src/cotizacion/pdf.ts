// PDF de la cotización para el cliente: cabecera con el logo y el nombre de la marca
// elegida, imagen grande del mueble justo debajo, título "Cotización <cliente>", datos en
// lista y cierre con vendedor, fecha y valor del mueble. Al pie, el contacto de la marca.
import { jsPDF } from 'jspdf';
import { formatoPrecio } from '../../shared/reglas';
import { formatoFecha } from '../../shared/resumen';
import type { Cliente, EstadoCotizacion, LineaDetalle, Venta } from '../../shared/tipos';
import { LOGO_MOLINA_PNG } from './logos';
import { MARCAS, type Marca } from './marcas';

export interface DatosDocumento {
  numero: string | null;
  cliente: Cliente;
  detalle: LineaDetalle[];
  observaciones: string | null;
  vendedor: string;
  vendedorTelefono?: string | null;
  fecha: string;
  valor: number;
  estado?: EstadoCotizacion;
  venta?: Venta | null;
  /** Imagen chica (lista) o, en cotizaciones viejas, la única que hay. */
  miniatura?: string | null;
  /** Imagen grande del mueble para el documento. */
  imagen?: string | null;
  /** Marca con la que se emite (sin marca = De Todito Outlet). */
  marca?: Marca;
}

export type Rgb = [number, number, number];
export const TEXTO: Rgb = [36, 33, 42];
export const GRIS: Rgb = [108, 103, 114];
export const LINEA: Rgb = [220, 214, 208];
export const FONDO_IMAGEN: Rgb = [243, 241, 238];
const COLOR_ESTADO: Record<EstadoCotizacion, Rgb> = { cotizada: [184, 115, 12], vendida: [23, 138, 69], anulada: [138, 132, 134] };
const NOMBRE_ESTADO: Record<EstadoCotizacion, string> = { cotizada: 'Cotizada', vendida: 'Vendida', anulada: 'Anulada' };

/** Colores de cada marca en los documentos: acento (líneas, valor) y su versión suave (fondos). */
export const COLORES_MARCA: Record<Marca, { acento: Rgb; suave: Rgb }> = {
  dto: { acento: [168, 50, 94], suave: [248, 233, 239] },
  molina: { acento: [12, 122, 176], suave: [229, 243, 250] },
};

export const A4 = { ancho: 210, alto: 297 };
export const MARGEN = 16;
const PIE = 7;

export function nombreArchivo(d: Pick<DatosDocumento, 'numero' | 'cliente'>, prefijo = 'Cotizacion'): string {
  const cliente = d.cliente.nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefijo}-${d.numero ?? 'borrador'}-${cliente || 'cliente'}.pdf`;
}

/** Datos del cliente que van en el recuadro bajo el título (solo los que existen). */
export function datosCliente(d: Pick<DatosDocumento, 'cliente'>): LineaDetalle[] {
  const c = d.cliente;
  const lineas: LineaDetalle[] = [{ etiqueta: 'Cliente', valor: c.nombre }];
  if (c.telefono) lineas.push({ etiqueta: 'Teléfono', valor: c.telefono });
  if (c.email) lineas.push({ etiqueta: 'Correo', valor: c.email });
  if (c.direccion) lineas.push({ etiqueta: 'Dirección / comuna', valor: c.direccion });
  return lineas;
}

/** Lista que se imprime después de los datos del cliente: detalle técnico y observaciones. */
export function lineasDocumento(d: Pick<DatosDocumento, 'detalle' | 'observaciones'>): LineaDetalle[] {
  const lineas: LineaDetalle[] = [...d.detalle];
  if (d.observaciones) lineas.push({ etiqueta: 'Observaciones', valor: d.observaciones });
  return lineas;
}

// ---------- Piezas comunes (también las usa la hoja del maestro) ----------

/** jsPDF con las fuentes estándar solo dibuja Latin-1: se cambian los pocos signos que quedan fuera. */
export function latin1(s: string): string {
  return s
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/[‐‑‒]/g, '-')
    .replace(/\u2212/g, '–')
    .replace(/[^\u0000-ÿ–—‘’“”•…€™ŒœŠšŸŽž]/g, '');
}

export function fuente(doc: jsPDF, estilo: 'normal' | 'bold', tam: number) {
  doc.setFont('helvetica', estilo);
  doc.setFontSize(tam);
}

export function colorTexto(doc: jsPDF, c: Rgb) {
  doc.setTextColor(c[0], c[1], c[2]);
}

/** Logo de la marca en un cuadrado de `tam` mm. */
export function dibujarLogo(doc: jsPDF, marca: Marca, x: number, y: number, tam: number) {
  if (marca === 'molina') {
    doc.addImage(LOGO_MOLINA_PNG, 'PNG', x, y, tam, tam, 'logo-molina', 'FAST');
    return;
  }
  // El distintivo rosado "DTO", como en public/marcas/de-todito-outlet.svg.
  doc.setFillColor(...COLORES_MARCA.dto.acento);
  doc.roundedRect(x, y, tam, tam, tam * 0.21, tam * 0.21, 'F');
  fuente(doc, 'bold', tam * 0.68);
  colorTexto(doc, [255, 255, 255]);
  doc.text('DTO', x + tam / 2, y + tam * 0.61, { align: 'center' });
}

/**
 * Cabecera con logo, nombre y lema de la marca a la izquierda y hasta dos líneas a la
 * derecha (número, estado o tipo de documento). Devuelve la y donde sigue el contenido.
 */
export function dibujarCabecera(
  doc: jsPDF,
  marca: Marca,
  y: number,
  derecha: { texto: string; color?: Rgb; tam?: number }[],
  tamLogo = 16,
): number {
  const m = MARCAS[marca];
  const borde = A4.ancho - MARGEN;
  dibujarLogo(doc, marca, MARGEN, y, tamLogo);
  const xTexto = MARGEN + tamLogo + 4;
  const centro = y + tamLogo / 2;
  fuente(doc, 'bold', tamLogo >= 14 ? 15 : 12);
  colorTexto(doc, TEXTO);
  doc.text(m.nombre, xTexto, centro - 0.6);
  fuente(doc, 'normal', tamLogo >= 14 ? 9 : 8);
  colorTexto(doc, GRIS);
  doc.text([m.lema, m.web].filter(Boolean).join(' · '), xTexto, centro + 4.4);
  derecha.forEach((l, i) => {
    fuente(doc, 'bold', l.tam ?? (i === 0 ? 11 : 9));
    colorTexto(doc, l.color ?? TEXTO);
    doc.text(l.texto, borde, centro - 0.6 + i * 5, { align: 'right' });
  });
  const yLinea = y + tamLogo + 3.5;
  doc.setDrawColor(...COLORES_MARCA[marca].acento);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, yLinea, borde, yLinea);
  return yLinea;
}

/**
 * Imagen del mueble ajustada al ancho útil (sin pasar de `altoMax`), centrada y sobre el
 * fondo del visor. Devuelve el alto usado (0 si la imagen no se pudo leer).
 */
export function dibujarImagen(doc: jsPDF, dataUrl: string, x: number, y: number, ancho: number, altoMax: number): number {
  try {
    const p = doc.getImageProperties(dataUrl);
    let alto = (ancho * p.height) / p.width;
    let anchoImg = ancho;
    if (alto > altoMax) {
      alto = altoMax;
      anchoImg = (alto * p.width) / p.height;
    }
    doc.setFillColor(...FONDO_IMAGEN);
    doc.roundedRect(x, y, ancho, alto, 2, 2, 'F');
    doc.addImage(dataUrl, p.fileType || 'JPEG', x + (ancho - anchoImg) / 2, y, anchoImg, alto, undefined, 'NONE');
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, ancho, alto, 2, 2, 'S');
    return alto;
  } catch {
    // Si la imagen no se puede leer, el documento sale sin ella.
    return 0;
  }
}

/** Contacto al pie: marca y web, más el vendedor con su teléfono (la marca no publica teléfonos aquí). */
export function textoContacto(marca: Marca, vendedor: string, telefono?: string | null): string {
  const m = MARCAS[marca];
  const partes = [m.nombre];
  if (m.web) partes.push(m.web);
  if (vendedor) partes.push(`Vendedor: ${vendedor}${telefono ? ` · ${telefono}` : ''}`);
  return partes.join(' · ');
}

// ---------- PDF del cliente ----------

export function crearPdf(d: DatosDocumento): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marca = d.marca ?? 'dto';
  const { acento, suave } = COLORES_MARCA[marca];
  const ancho = A4.ancho - MARGEN * 2;
  const derecha = A4.ancho - MARGEN;
  const limite = A4.alto - MARGEN - PIE;
  let y = MARGEN - 2;

  const color = (c: Rgb) => colorTexto(doc, c);
  const letra = (estilo: 'normal' | 'bold', tam: number) => fuente(doc, estilo, tam);
  const saltoSi = (alto: number) => {
    if (y + alto > limite) {
      doc.addPage();
      y = MARGEN;
    }
  };

  // Cabecera: logo y nombre de la marca; a la derecha el número y el estado.
  const derechaCabeza: { texto: string; color?: Rgb }[] = [{ texto: d.numero ? `N° ${d.numero}` : 'Borrador' }];
  if (d.estado) derechaCabeza.push({ texto: NOMBRE_ESTADO[d.estado], color: COLOR_ESTADO[d.estado] });
  y = dibujarCabecera(doc, marca, y, derechaCabeza) + 5;

  // Se mide primero todo lo que va bajo la imagen para elegir su alto.
  letra('bold', 16);
  const titulo = doc.splitTextToSize(latin1(`Cotización ${d.cliente.nombre}`), ancho) as string[];
  const altoTitulo = titulo.length * 6.6;

  // Datos del cliente en un recuadro de dos columnas (cada dato puede ocupar más de un renglón).
  const anchoColumna = ancho / 2 - 6;
  const celdas = datosCliente(d).map((l) => {
    letra('bold', 9.5);
    const etiqueta = `${latin1(l.etiqueta)}: `;
    const anchoEtiqueta = doc.getTextWidth(etiqueta);
    letra('normal', 9.5);
    const renglones = doc.splitTextToSize(latin1(l.valor), anchoColumna - anchoEtiqueta) as string[];
    return { etiqueta, anchoEtiqueta, renglones: renglones.slice(0, 3) };
  });
  const filasCliente: number[] = [];
  for (let i = 0; i < celdas.length; i += 2) filasCliente.push(Math.max(...celdas.slice(i, i + 2).map((c) => c.renglones.length)));
  const altoCliente = 4.2 + filasCliente.reduce((t, n) => t + 5.6 + (n - 1) * 4.2, 0);

  // Detalle y observaciones en lista
  const interlinea = 4.8;
  const items = lineasDocumento(d).map((original) => {
    const l = { etiqueta: latin1(original.etiqueta), valor: latin1(original.valor), sub: original.sub?.map(latin1) };
    letra('bold', 10);
    const etiqueta = `${l.etiqueta}: `;
    const anchoEtiqueta = doc.getTextWidth(etiqueta);
    letra('normal', 10);
    // La primera línea comparte renglón con la etiqueta en negrita.
    const palabras = l.valor.split(/\s+/).filter(Boolean);
    let primera = '';
    let i = 0;
    while (i < palabras.length) {
      const prueba = primera ? `${primera} ${palabras[i]}` : palabras[i];
      if (doc.getTextWidth(prueba) > ancho - 5 - anchoEtiqueta) break;
      primera = prueba;
      i++;
    }
    const resto = palabras.slice(i).join(' ');
    const siguientes = resto ? (doc.splitTextToSize(resto, ancho - 5) as string[]) : [];
    letra('normal', 9.2);
    const subs = (l.sub ?? []).flatMap((s) => doc.splitTextToSize(`– ${s}`, ancho - 11) as string[]);
    return { etiqueta, anchoEtiqueta, primera, siguientes, subs, alto: interlinea * (1 + siguientes.length) + subs.length * 4.3 + 1.2 };
  });
  const altoCierre = 22 + (d.venta ? 13 : 0);
  const altoContenido = altoTitulo + altoCliente + 4.5 + items.reduce((t, it) => t + it.alto, 0) + altoCierre;

  // Imagen general del mueble, justo debajo del nombre de la empresa: grande, y algo más baja
  // (nunca menos de 62 mm) si así la cotización completa cabe en una sola hoja.
  const imagen = d.imagen || d.miniatura;
  if (imagen) {
    // 2 mm de resguardo: si la imagen llena justo el espacio, el redondeo no debe mandar el cierre a otra hoja.
    const libre = limite - y - 9 - altoContenido - 2;
    const alto = dibujarImagen(doc, imagen, MARGEN, y, ancho, libre >= 62 ? Math.min(100, libre) : 100);
    if (alto) y += alto + 9;
  }

  // Título
  letra('bold', 16);
  color(TEXTO);
  for (const l of titulo) {
    doc.text(l, MARGEN, y);
    y += 6.6;
  }

  doc.setFillColor(...FONDO_IMAGEN);
  doc.roundedRect(MARGEN, y - 1.5, ancho, altoCliente, 2, 2, 'F');
  let yFila = y + 3.6;
  filasCliente.forEach((n, f) => {
    celdas.slice(f * 2, f * 2 + 2).forEach((c, columna) => {
      const xc = MARGEN + 4 + columna * (ancho / 2);
      letra('bold', 9.5);
      color(TEXTO);
      doc.text(c.etiqueta, xc, yFila);
      letra('normal', 9.5);
      c.renglones.forEach((r, k) => doc.text(r, xc + c.anchoEtiqueta, yFila + k * 4.2));
    });
    yFila += 5.6 + (n - 1) * 4.2;
  });
  y += altoCliente + 4.5;

  for (const it of items) {
    saltoSi(it.alto);
    letra('bold', 10);
    color(acento);
    doc.text('•', MARGEN + 1, y);
    color(TEXTO);
    doc.text(it.etiqueta, MARGEN + 5, y);
    letra('normal', 10);
    if (it.primera) doc.text(it.primera, MARGEN + 5 + it.anchoEtiqueta, y);
    for (const s of it.siguientes) {
      y += interlinea;
      doc.text(s, MARGEN + 5, y);
    }
    letra('normal', 9.2);
    color(GRIS);
    for (const s of it.subs) {
      y += 4.3;
      doc.text(s, MARGEN + 10, y);
    }
    y += interlinea + 1.2;
  }

  // Cierre: vendedor y fecha a la izquierda, valor del mueble a la derecha (siempre juntos)
  saltoSi(altoCierre);
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.3);
  doc.line(MARGEN, y, derecha, y);
  y += 4;
  const anchoValor = 82;
  const xValor = derecha - anchoValor;
  const fila = (etiqueta: string, valor: string, yy: number) => {
    letra('normal', 10);
    color(GRIS);
    doc.text(etiqueta, MARGEN, yy);
    letra('bold', 10);
    color(TEXTO);
    doc.text((doc.splitTextToSize(valor, xValor - MARGEN - 36) as string[])[0], MARGEN + 33, yy);
  };
  fila('Vendedor', d.vendedorTelefono ? `${d.vendedor} · ${d.vendedorTelefono}` : d.vendedor, y + 5.2);
  fila('Fecha cotización', formatoFecha(d.fecha), y + 11.6);
  doc.setFillColor(...suave);
  doc.roundedRect(xValor, y, anchoValor, 15, 2.5, 2.5, 'F');
  letra('bold', 11);
  color(acento);
  doc.text('Valor mueble', xValor + 4.5, y + 9.4);
  letra('bold', 15);
  doc.text(latin1(formatoPrecio(d.valor)), derecha - 4.5, y + 9.8, { align: 'right' });
  y += 20;

  if (d.venta) {
    doc.setFillColor(232, 246, 238);
    doc.roundedRect(MARGEN, y, ancho, 10, 2, 2, 'F');
    letra('bold', 9.5);
    color(COLOR_ESTADO.vendida);
    const extra = [d.venta.medioPago, d.venta.nota].filter(Boolean).join(' · ');
    doc.text(latin1(`Venta registrada el ${formatoFecha(d.venta.fecha)} por ${formatoPrecio(d.venta.valor)}${extra ? ` · ${extra}` : ''}`), MARGEN + 4, y + 6.4);
    y += 14;
  }

  // Pie de página: contacto de la marca y del vendedor, número de cotización y página.
  const paginas = doc.getNumberOfPages();
  const contacto = textoContacto(marca, d.vendedor, d.vendedorTelefono);
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, A4.alto - 15, derecha, A4.alto - 15);
    letra('normal', 8);
    color(GRIS);
    doc.text(doc.splitTextToSize(contacto, ancho - 26)[0] as string, MARGEN, A4.alto - 10.5);
    doc.text(`Cotización ${d.numero ? `N° ${d.numero}` : 'borrador'} · Valores en pesos chilenos`, MARGEN, A4.alto - 6.5);
    doc.text(`Página ${p} de ${paginas}`, derecha, A4.alto - 10.5, { align: 'right' });
  }
  return doc;
}

export function pdfComoArchivo(d: DatosDocumento): File {
  const blob = crearPdf(d).output('blob');
  return new File([blob], nombreArchivo(d), { type: 'application/pdf' });
}

export function descargarPdf(d: DatosDocumento) {
  crearPdf(d).save(nombreArchivo(d));
}
