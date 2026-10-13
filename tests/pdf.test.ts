import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { crearPdf, lineasDocumento, nombreArchivo, type DatosDocumento } from '../src/cotizacion/pdf';

// JPEG de 2×1 px para probar la imagen del mueble.
const JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const datos: DatosDocumento = {
  numero: 'COT-0007',
  cliente: { nombre: 'Fernando Pérez', telefono: '+56 9 1234 5678', email: 'fernando@correo.cl', direccion: 'La Granja' },
  detalle: [
    { etiqueta: 'Modelo base', valor: 'Cocina full equipo: horno, encimera y lavaplatos · Clasic Pino Casina (código 16)' },
    { etiqueta: 'Medidas', valor: '150 × 90 × 60 cm (ancho × alto × profundidad)' },
    { etiqueta: 'Distribución', valor: '3 cuerpos', sub: ['Cuerpo 1 (60 cm): horno empotrado', 'Cuerpo 2 (45 cm): 3 cajones'] },
  ],
  observaciones: 'Instalación incluida, despacho en 5 días hábiles.',
  vendedor: 'Camila Rojas',
  vendedorTelefono: '+56 9 8765 4321',
  fecha: '2026-10-13',
  valor: 519990,
  estado: 'cotizada',
  venta: null,
  miniatura: JPEG,
};

function textoPdf(d: DatosDocumento): string {
  const archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-')), 'c.pdf');
  fs.writeFileSync(archivo, Buffer.from(crearPdf(d).output('arraybuffer')));
  return execFileSync('pdftotext', ['-layout', archivo, '-'], { encoding: 'utf8' });
}

describe('PDF de la cotización', () => {
  it('nombra el archivo con el número y el cliente sin tildes', () => {
    expect(nombreArchivo(datos)).toBe('Cotizacion-COT-0007-Fernando-Perez.pdf');
  });

  it('arma la lista con los datos del cliente antes del detalle', () => {
    expect(lineasDocumento(datos).map((l) => l.etiqueta)).toEqual([
      'Cliente',
      'Teléfono',
      'Correo',
      'Dirección / comuna',
      'Modelo base',
      'Medidas',
      'Distribución',
      'Observaciones',
    ]);
  });

  it('incluye título, lista y cierre con vendedor, fecha y valor del mueble', () => {
    const t = textoPdf(datos);
    expect(t).toContain('Cotización Fernando Pérez');
    expect(t).toContain('N° COT-0007');
    expect(t).toContain('150 × 90 × 60 cm');
    expect(t).toContain('Cuerpo 2 (45 cm): 3 cajones');
    expect(t).toContain('Instalación incluida');
    expect(t).toMatch(/Vendedor\s+Camila Rojas · \+56 9 8765 4321/);
    expect(t).toMatch(/Fecha cotización\s+13-10-2026/);
    expect(t).toMatch(/Valor mueble\s+\$519\.990/);
    // El cierre va después de la lista.
    expect(t.indexOf('Valor mueble')).toBeGreaterThan(t.indexOf('Observaciones'));
  });

  it('muestra la venta registrada', () => {
    const t = textoPdf({ ...datos, estado: 'vendida', venta: { fecha: '2026-10-15', valor: 500000, medioPago: 'Transferencia', nota: null } });
    expect(t).toContain('Venta registrada el 15-10-2026 por $500.000 · Transferencia');
  });

  it('pasa a una segunda página cuando el detalle es largo', () => {
    const largo = { ...datos, detalle: Array.from({ length: 40 }, (_, i) => ({ etiqueta: `Dato ${i + 1}`, valor: 'texto de prueba '.repeat(8) })) };
    const doc = crearPdf(largo);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});

describe('PDF de una cotización típica', () => {
  it('cabe en una sola página con imagen y cierre', () => {
    const detalle = Array.from({ length: 10 }, (_, i) => ({ etiqueta: `Dato ${i + 1}`, valor: 'texto de prueba '.repeat(i === 8 ? 10 : 3) }));
    detalle[2] = { ...detalle[2], sub: ['Cuerpo 1 (60 cm): horno empotrado', 'Cuerpo 2 (45 cm): 3 cajones', 'Cuerpo 3 (45 cm): 1 puerta'] } as never;
    const doc = crearPdf({ ...datos, miniatura: null, detalle });
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
