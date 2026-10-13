// PDF de la cotización: cabecera de la tienda, título "Cotización <cliente>",
// imagen 3D, datos en lista y cierre con vendedor, fecha y valor del mueble.
import { jsPDF } from 'jspdf';
import { formatoPrecio } from '../../shared/reglas';
import { formatoFecha } from '../../shared/resumen';
import type { Cliente, EstadoCotizacion, LineaDetalle, Venta } from '../../shared/tipos';

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
  miniatura?: string | null;
}

type Rgb = [number, number, number];
const ACENTO: Rgb = [168, 50, 94];
const ACENTO_SUAVE: Rgb = [248, 233, 239];
const TEXTO: Rgb = [36, 33, 42];
const GRIS: Rgb = [108, 103, 114];
const COLOR_ESTADO: Record<EstadoCotizacion, Rgb> = { cotizada: [184, 115, 12], vendida: [23, 138, 69], anulada: [138, 132, 134] };
const NOMBRE_ESTADO: Record<EstadoCotizacion, string> = { cotizada: 'Cotizada', vendida: 'Vendida', anulada: 'Anulada' };

const A4 = { ancho: 210, alto: 297 };
const MARGEN = 16;
const PIE = 14;

export function nombreArchivo(d: Pick<DatosDocumento, 'numero' | 'cliente'>): string {
  const cliente = d.cliente.nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `Cotizacion-${d.numero ?? 'borrador'}-${cliente || 'cliente'}.pdf`;
}

/** Lista que se imprime: datos del cliente, detalle técnico y observaciones. */
export function lineasDocumento(d: DatosDocumento): LineaDetalle[] {
  const c = d.cliente;
  const lineas: LineaDetalle[] = [{ etiqueta: 'Cliente', valor: c.nombre }];
  if (c.telefono) lineas.push({ etiqueta: 'Teléfono', valor: c.telefono });
  if (c.email) lineas.push({ etiqueta: 'Correo', valor: c.email });
  if (c.direccion) lineas.push({ etiqueta: 'Dirección / comuna', valor: c.direccion });
  lineas.push(...d.detalle);
  if (d.observaciones) lineas.push({ etiqueta: 'Observaciones', valor: d.observaciones });
  return lineas;
}

export function crearPdf(d: DatosDocumento): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ancho = A4.ancho - MARGEN * 2;
  const derecha = A4.ancho - MARGEN;
  let y = MARGEN;

  const color = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);
  const fuente = (estilo: 'normal' | 'bold', tam: number) => {
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tam);
  };
  const saltoSi = (alto: number) => {
    if (y + alto > A4.alto - MARGEN - PIE) {
      doc.addPage();
      y = MARGEN;
    }
  };

  // Cabecera
  doc.setFillColor(...ACENTO);
  doc.roundedRect(MARGEN, y, 12, 12, 2.5, 2.5, 'F');
  fuente('bold', 8);
  color([255, 255, 255]);
  doc.text('DTO', MARGEN + 6, y + 7.3, { align: 'center' });
  fuente('bold', 12);
  color(TEXTO);
  doc.text('De Todito Outlet', MARGEN + 15, y + 5.2);
  fuente('normal', 8.5);
  color(GRIS);
  doc.text('Muebles a medida · detoditooutlet.cl', MARGEN + 15, y + 9.8);
  fuente('bold', 11);
  color(TEXTO);
  doc.text(d.numero ? `N° ${d.numero}` : 'Borrador', derecha, y + 5.2, { align: 'right' });
  if (d.estado) {
    fuente('bold', 8.5);
    color(COLOR_ESTADO[d.estado]);
    doc.text(NOMBRE_ESTADO[d.estado], derecha, y + 9.8, { align: 'right' });
  }
  y += 15;
  doc.setDrawColor(...ACENTO);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, y, derecha, y);
  y += 9;

  // Título
  fuente('bold', 17);
  color(TEXTO);
  for (const l of doc.splitTextToSize(`Cotización ${d.cliente.nombre}`, ancho) as string[]) {
    doc.text(l, MARGEN, y);
    y += 7;
  }

  // Imagen del mueble
  if (d.miniatura) {
    try {
      const p = doc.getImageProperties(d.miniatura);
      let alto = (ancho * p.height) / p.width;
      let anchoImg = ancho;
      if (alto > 68) {
        alto = 68;
        anchoImg = (alto * p.width) / p.height;
      }
      doc.setFillColor(243, 241, 238);
      doc.roundedRect(MARGEN, y, ancho, alto, 2, 2, 'F');
      doc.addImage(d.miniatura, p.fileType || 'JPEG', MARGEN + (ancho - anchoImg) / 2, y, anchoImg, alto);
      y += alto + 7;
    } catch {
      // Si la imagen no se puede leer, el PDF sale sin ella.
    }
  }

  // Datos en lista
  const interlinea = 5;
  for (const l of lineasDocumento(d)) {
    fuente('bold', 10);
    const etiqueta = `${l.etiqueta}: `;
    const anchoEtiqueta = doc.getTextWidth(etiqueta);
    fuente('normal', 10);
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
    fuente('normal', 9.2);
    const subs = (l.sub ?? []).flatMap((s) => doc.splitTextToSize(`– ${s}`, ancho - 11) as string[]);
    saltoSi(interlinea * (1 + siguientes.length) + subs.length * 4.5 + 1.5);

    fuente('bold', 10);
    color(ACENTO);
    doc.text('•', MARGEN + 1, y);
    color(TEXTO);
    doc.text(etiqueta, MARGEN + 5, y);
    fuente('normal', 10);
    if (primera) doc.text(primera, MARGEN + 5 + anchoEtiqueta, y);
    for (const s of siguientes) {
      y += interlinea;
      doc.text(s, MARGEN + 5, y);
    }
    fuente('normal', 9.2);
    color(GRIS);
    for (const s of subs) {
      y += 4.5;
      doc.text(s, MARGEN + 10, y);
    }
    y += interlinea + 1.5;
  }

  // Cierre: vendedor, fecha y valor del mueble (siempre juntos en la misma página)
  saltoSi(37);
  y += 1;
  doc.setDrawColor(220, 214, 208);
  doc.setLineWidth(0.3);
  doc.line(MARGEN, y, derecha, y);
  y += 7;
  const fila = (etiqueta: string, valor: string) => {
    fuente('normal', 10.5);
    color(GRIS);
    doc.text(etiqueta, MARGEN, y);
    fuente('bold', 10.5);
    color(TEXTO);
    doc.text(valor, derecha, y, { align: 'right' });
    y += 6.5;
  };
  fila('Vendedor', d.vendedorTelefono ? `${d.vendedor} · ${d.vendedorTelefono}` : d.vendedor);
  fila('Fecha cotización', formatoFecha(d.fecha));
  y += 1;
  doc.setFillColor(...ACENTO_SUAVE);
  doc.roundedRect(MARGEN, y, ancho, 14, 2.5, 2.5, 'F');
  fuente('bold', 12.5);
  color(ACENTO);
  doc.text('Valor mueble', MARGEN + 5, y + 9);
  fuente('bold', 16);
  doc.text(formatoPrecio(d.valor), derecha - 5, y + 9.4, { align: 'right' });
  y += 20;

  if (d.venta) {
    saltoSi(12);
    doc.setFillColor(232, 246, 238);
    doc.roundedRect(MARGEN, y, ancho, 10, 2, 2, 'F');
    fuente('bold', 9.5);
    color(COLOR_ESTADO.vendida);
    const extra = [d.venta.medioPago, d.venta.nota].filter(Boolean).join(' · ');
    doc.text(`Venta registrada el ${formatoFecha(d.venta.fecha)} por ${formatoPrecio(d.venta.valor)}${extra ? ` · ${extra}` : ''}`, MARGEN + 4, y + 6.4);
    y += 14;
  }

  // Pie de página
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    fuente('normal', 8);
    color(GRIS);
    doc.text(`De Todito Outlet · Cotización ${d.numero ? `N° ${d.numero}` : 'borrador'} · Valores en pesos chilenos`, MARGEN, A4.alto - 10);
    doc.text(`Página ${p} de ${paginas}`, derecha, A4.alto - 10, { align: 'right' });
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
