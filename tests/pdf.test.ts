import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial } from '../shared/catalogo';
import { activarAereos, ejecutar, fijarAncho, fijarForma } from '../shared/reglas';
import type { CatalogoMateriales, ProductoTienda } from '../shared/tipos';
import { crearHojaMaestro, murosDe, nombreArchivoMaestro } from '../src/cotizacion/hojaMaestro';
import { marcaDe, textoCotizacionMarca } from '../src/cotizacion/marcas';
import { crearPdf, datosCliente, lineasDocumento, nombreArchivo, type DatosDocumento } from '../src/cotizacion/pdf';

// JPEG de 2×1 px para probar la imagen del mueble.
const JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const datos: DatosDocumento = {
  numero: 'COT-0007',
  cliente: { nombre: 'Fernando Pérez', telefono: '+56 9 1234 5678', email: 'fernando@correo.cl', direccion: 'La Granja' },
  detalle: [
    { etiqueta: 'Modelo base', valor: 'Cocina full equipo: horno, encimera y lavaplatos · Clasic Pino Casina (código 16)' },
    { etiqueta: 'Medidas', valor: '150 × 90 × 60 cm (ancho × alto × profundidad)' },
    { etiqueta: 'Distribución', valor: '3 módulos', sub: ['Módulo 1 (60 cm): horno empotrado', 'Módulo 2 (45 cm): 3 cajones'] },
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

function textoDe(doc: { output(t: 'arraybuffer'): ArrayBuffer }): string {
  const archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-')), 'c.pdf');
  fs.writeFileSync(archivo, Buffer.from(doc.output('arraybuffer')));
  return execFileSync('pdftotext', ['-layout', archivo, '-'], { encoding: 'utf8' });
}

const textoPdf = (d: DatosDocumento) => textoDe(crearPdf(d));

// Cocina en L con aéreos, especiero y lavaplatos doble en el lado (como la que se cotiza en tienda).
const productos = JSON.parse(fs.readFileSync('public/datos/productos-respaldo.json', 'utf8')) as ProductoTienda[];
const materiales = JSON.parse(fs.readFileSync('public/datos/materiales.json', 'utf8')) as CatalogoMateriales;
const producto = clasificarProducto(productos.find((p) => p.id === 16)!);
function cocinaEnL() {
  let d = activarAereos(fijarForma(fijarAncho(disenoInicial(producto), 2400), 'L-izq'), true);
  d = ejecutar(d, { op: 'agregarModulo', tramo: 'base', preset: 'especiero', posicion: 1 }).diseno;
  const lav = d.equipos.find((e) => e.tipo === 'lavaplatos')!;
  d = ejecutar(d, { op: 'moverEquipo', id: lav.id, tramo: 'izq', modulo: 0 }).diseno;
  return ejecutar(d, { op: 'configurarEquipo', id: lav.id, cambios: { modelo: 'doble' } }).diseno;
}

describe('PDF de la cotización', () => {
  it('nombra el archivo con el número y el cliente sin tildes', () => {
    expect(nombreArchivo(datos)).toBe('Cotizacion-COT-0007-Fernando-Perez.pdf');
  });

  it('separa los datos del cliente (recuadro) del detalle y las observaciones (lista)', () => {
    expect(datosCliente(datos).map((l) => l.etiqueta)).toEqual(['Cliente', 'Teléfono', 'Correo', 'Dirección / comuna']);
    expect(datosCliente({ cliente: { nombre: 'Ana', telefono: null, email: '', direccion: null } }).map((l) => l.etiqueta)).toEqual(['Cliente']);
    expect(lineasDocumento(datos).map((l) => l.etiqueta)).toEqual(['Modelo base', 'Medidas', 'Distribución', 'Observaciones']);
  });

  it('incluye título, lista y cierre con vendedor, fecha y valor del mueble', () => {
    const t = textoPdf(datos);
    expect(t).toContain('Cotización Fernando Pérez');
    expect(t).toContain('N° COT-0007');
    expect(t).toContain('150 × 90 × 60 cm');
    expect(t).toContain('Módulo 2 (45 cm): 3 cajones');
    expect(t).toContain('Instalación incluida');
    expect(t).toMatch(/Cliente: Fernando Pérez\s+Teléfono: \+56 9 1234 5678/);
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
    detalle[2] = { ...detalle[2], sub: ['Módulo 1 (60 cm): horno empotrado', 'Módulo 2 (45 cm): 3 cajones', 'Módulo 3 (45 cm): 1 puerta'] } as never;
    const doc = crearPdf({ ...datos, miniatura: null, detalle });
    expect(doc.getNumberOfPages()).toBe(1);
  });
});

describe('marca de la cotización', () => {
  it('sin marca (cotizaciones viejas) sale De Todito Outlet', () => {
    expect(marcaDe({})).toBe('dto');
    expect(marcaDe({ marca: 'otra' })).toBe('dto');
    expect(marcaDe({ marca: 'molina' })).toBe('molina');
    const t = textoPdf(datos);
    expect(t).toContain('De Todito Outlet');
    expect(t).toContain('DTO');
    expect(t).not.toContain('Molina');
  });

  it('con Muebles y Hogar Molina: nombre arriba, logo, imagen y el contacto de la marca al pie', () => {
    const doc = crearPdf({ ...datos, marca: 'molina', imagen: JPEG });
    const t = textoDe(doc);
    expect(t).toContain('Muebles y Hogar Molina');
    expect(t).not.toContain('De Todito Outlet');
    // El nombre de la empresa va antes del título y la imagen entre ambos (la imagen no tiene texto).
    expect(t.indexOf('Muebles y Hogar Molina')).toBeLessThan(t.indexOf('Cotización Fernando Pérez'));
    const crudo = Buffer.from(doc.output('arraybuffer')).toString('latin1');
    expect((crudo.match(/\/Subtype \/Image/g) ?? []).length).toBe(2);
  });

  it('el texto para WhatsApp y correo lleva la marca elegida', () => {
    const c = { numero: 'COT-0007', cliente: datos.cliente, detalle: datos.detalle, observaciones: null, vendedor: { id: 'v', nombre: 'Camila', telefono: null }, fecha: '2026-10-13', valor: 519990 };
    expect(textoCotizacionMarca({ ...c, marca: 'molina' })).toContain('Muebles y Hogar Molina · Muebles a medida');
    expect(textoCotizacionMarca(c)).toContain('De Todito Outlet · Muebles a medida');
  });
});

describe('hoja para el maestro', () => {
  const d = cocinaEnL();
  const hoja = () =>
    crearHojaMaestro({
      marca: 'molina',
      numero: 'COT-0012',
      cliente: { nombre: 'Fernanda Pérez', telefono: null, email: null, direccion: 'Los Aromos 123, La Granja' },
      fecha: '2026-10-19',
      vendedor: 'Camila Rojas',
      modelo: 'Cocina full equipo',
      imagen: JPEG,
      diseno: d,
      producto,
      materiales,
      unidad: 'cm',
      observaciones: 'Confirmar el enchufe del horno.',
    });

  it('nombra el archivo como hoja del maestro', () => {
    expect(nombreArchivoMaestro({ numero: 'COT-0012', cliente: { nombre: 'Fernanda Pérez', telefono: null, email: null, direccion: null } })).toBe('Hoja-maestro-COT-0012-Fernanda-Perez.pdf');
  });

  it('dibuja un esquema por muro con sus módulos (lado izquierdo y principal, con aéreos)', () => {
    const muros = murosDe(d);
    expect(muros.map((m) => m.titulo)).toEqual(['Lado izquierdo (mirando el muro izquierdo)', 'Muro principal']);
    expect(muros[1].base?.modulos.length).toBe(d.cuerpos.length);
    expect(muros[1].aereo?.modulos.length).toBe(d.aereos.cuerpos.length);
    expect(muros[0].base?.modulos.length).toBe(d.lados.izq!.cuerpos.length);
    expect(muros[0].equipos.some((e) => e.texto.startsWith('Lavaplatos'))).toBe(true);
  });

  it('trae marca, N°, cliente, fecha, ficha completa y observaciones, sin precios', () => {
    const doc = hoja();
    const t = textoDe(doc);
    for (const texto of ['Muebles y Hogar Molina', 'HOJA PARA EL MAESTRO', 'N° COT-0012', 'Fernanda Pérez', '19-10-2026', 'ESQUEMA FRONTAL', 'Muro principal', 'Lado izquierdo', 'Confirmar el enchufe del horno']) {
      expect(t).toContain(texto);
    }
    expect(t).toMatch(/Especiero/i);
    expect(t).toMatch(/Lavaplatos doble/i);
    expect(t).toMatch(/bisagra/i);
    expect(t).toMatch(/[Aa]éreo/);
    expect(t).toMatch(/[Zz]ócalo/);
    expect(t).toMatch(/[Cc]ubierta/);
    expect(t).not.toMatch(/\$\s?\d/);
    // Paginado con encabezado corto y número de página en cada hoja.
    const paginas = doc.getNumberOfPages();
    expect(paginas).toBeGreaterThan(1);
    expect(t).toContain(`Página ${paginas} de ${paginas}`);
    expect((t.match(/Hoja para el maestro · N° COT-0012/g) ?? []).length).toBeGreaterThanOrEqual(paginas);
  });
});
