// Envío de la cotización al cliente: correo (Gmail, Outlook o la app de
// correo del equipo), WhatsApp y, en teléfonos, compartir el PDF directo.
import { telefonoWhatsapp, textoCotizacion } from '../../shared/resumen';
import type { Cotizacion } from '../../shared/tipos';
import { pdfComoArchivo, type DatosDocumento } from './pdf';

export type ServicioCorreo = 'gmail' | 'outlook' | 'app';

export function asuntoCorreo(c: Pick<Cotizacion, 'numero' | 'cliente'>): string {
  return `Cotización ${c.numero} · ${c.cliente.nombre} · De Todito Outlet`;
}

export function cuerpoMensaje(c: Cotizacion, medio: 'correo' | 'whatsapp'): string {
  const nombre = c.cliente.nombre.split(' ')[0];
  const intro =
    medio === 'correo'
      ? `Hola ${nombre}:\n\nTe envío la cotización de tu mueble a medida. Adjunto el PDF con el detalle.\n\n`
      : `Hola ${nombre}, te envío tu cotización de De Todito Outlet:\n\n`;
  const despedida = medio === 'correo' ? `\n\nSaludos,\n${c.vendedor.nombre}\nDe Todito Outlet${c.vendedor.telefono ? `\n${c.vendedor.telefono}` : ''}` : '';
  return intro + textoCotizacion(c) + despedida;
}

export function enlaceCorreo(c: Cotizacion, servicio: ServicioCorreo): string {
  const para = c.cliente.email ?? '';
  const asunto = asuntoCorreo(c);
  const cuerpo = cuerpoMensaje(c, 'correo');
  const q = encodeURIComponent;
  switch (servicio) {
    case 'gmail':
      return `https://mail.google.com/mail/?view=cm&fs=1&to=${q(para)}&su=${q(asunto)}&body=${q(cuerpo)}`;
    case 'outlook':
      return `https://outlook.office.com/mail/deeplink/compose?to=${q(para)}&subject=${q(asunto)}&body=${q(cuerpo)}`;
    default:
      return `mailto:${q(para)}?subject=${q(asunto)}&body=${q(cuerpo)}`;
  }
}

export function enlaceWhatsapp(c: Cotizacion): string {
  const numero = telefonoWhatsapp(c.cliente.telefono);
  return `https://wa.me/${numero ?? ''}?text=${encodeURIComponent(cuerpoMensaje(c, 'whatsapp'))}`;
}

/** El navegador permite compartir archivos (teléfonos y tablets, sobre todo). */
export function puedeCompartirArchivos(): boolean {
  try {
    const prueba = new File(['x'], 'prueba.pdf', { type: 'application/pdf' });
    return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [prueba] });
  } catch {
    return false;
  }
}

/** Abre el menú de compartir del sistema con el PDF adjunto (WhatsApp, correo, etc.). */
export async function compartirPdf(c: Cotizacion, datos: DatosDocumento): Promise<void> {
  const archivo = pdfComoArchivo(datos);
  await navigator.share({ files: [archivo], title: asuntoCorreo(c), text: `Cotización ${c.numero} de De Todito Outlet` });
}
