import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial } from '../shared/catalogo';
import { activarAereos, ejecutar, fijarAncho, fijarForma } from '../shared/reglas';
import type { CatalogoMateriales, ProductoTienda } from '../shared/tipos';
import { fichaFabricacion, textoFicha } from '../shared/resumen';
import { contenidoHoja, crearHojaMaestro, esquemaSvg, murosDe, nombreArchivoMaestro, renglonesCelda, tablaDeLineas } from '../src/cotizacion/hojaMaestro';
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

  it('cada módulo en una tabla por tramo: frentes con su medida exacta, apertura de cada puerta y cajones', () => {
    const ficha = fichaFabricacion(d, producto, 'cm', materiales);
    const titulos = ficha.secciones.map((s) => s.titulo);
    expect(titulos.slice(0, 3)).toEqual(['Forma y medidas generales', 'Lado izquierdo', 'Tramo principal']);
    expect(titulos).toEqual(expect.arrayContaining(['Muebles aéreos', 'Aéreo principal', 'Equipamiento', 'Cubierta', 'Materiales', 'Frentes para cortar', 'Notas']));
    const principal = ficha.secciones.find((s) => s.titulo === 'Tramo principal')!;
    expect(principal.tabla!.columnas).toEqual(['N°', 'Módulo y ubicación', 'Ancho', 'Frentes: ancho × alto y apertura', 'Interior y equipamiento']);
    expect(principal.tabla!.filas.length).toBe(d.cuerpos.length);
    const celdas = principal.tabla!.filas.map((f) => f.celdas.join(' | ')).join('\n');
    expect(celdas).toMatch(/Cajón 1 \(arriba\): \d+(,\d)? × \d+(,\d)? cm/);
    expect(celdas).toMatch(/Puerta 1: \d+(,\d)? × \d+(,\d)? cm · abre a la (izquierda|derecha) \(bisagras (izq|der)\.\)/);
    expect(celdas).toMatch(/Frente del especiero \(extraíble\)/);
    expect(celdas).toMatch(/Encimera a gas 4 platos \(quemadores\)/);
    expect(celdas).toMatch(/Horno eléctrico 58 L Sindelen \(60 cm\); hueco/);
    // Las medidas salen del layout del motor: la puerta del módulo 1 del lado izquierdo.
    const lado = ficha.secciones.find((s) => s.titulo === 'Lado izquierdo')!;
    expect(lado.tabla!.filas[0].celdas[4]).toMatch(/Lavaplatos doble \(2 cubetas\), centrado, con llave/);
    const eq = ficha.secciones.find((s) => s.titulo === 'Equipamiento')!;
    expect(eq.tabla!.filas.map((f) => f.celdas[0])).toEqual(expect.arrayContaining(['Horno', 'Encimera', 'Lavaplatos', 'Llave monomando']));
    expect(eq.tabla!.filas.find((f) => f.celdas[0] === 'Encimera')!.celdas[1]).toMatch(/^A gas, 4 platos \(quemadores\)/);
    const cortar = ficha.secciones.find((s) => s.titulo === 'Frentes para cortar')!;
    const total = cortar.tabla!.filas.reduce((a, f) => a + Number(f.celdas[2]), 0);
    expect(total).toBeGreaterThan(d.cuerpos.length);
    // El texto plano conserva una línea por fila.
    expect(textoFicha(ficha)).toMatch(/• Módulo \d · \d+ cm: Cajonera de 3 cajones/);
  });

  it('las líneas sueltas y las celdas se arman igual para el PDF y la vista en la aplicación', () => {
    const t = tablaDeLineas([{ etiqueta: 'Piezas', valor: '2 piezas', sub: ['tramo principal'] }]);
    expect(t.filas[0].celdas).toEqual(['Piezas', '2 piezas\n– tramo principal']);
    expect(renglonesCelda({ destacar: [1] }, 1, 'Cajonera\nde 0 a 60 cm')).toEqual([
      { texto: 'Cajonera', negrita: true, gris: false },
      { texto: 'de 0 a 60 cm', negrita: false, gris: true },
    ]);
  });

  it('el esquema de cada muro también sale en SVG (vista de la hoja dentro de la aplicación)', () => {
    const c = contenidoHoja(d, producto, 'cm', materiales);
    expect(c.muros.length).toBe(2);
    const svg = esquemaSvg(c.muros[1], c.escala, 'cm', 'molina');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toMatch(/viewBox="[-\d. ]+"/);
    expect((svg.match(/<rect /g) ?? []).length).toBeGreaterThan(10);
    expect(svg).toContain('HORNO');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('300 cm con la esquina');
  });

  it('el PDF de la hoja trae las tablas con medidas de puertas y cajones, apertura, encimera y lavaplatos', () => {
    const t = textoDe(hoja());
    for (const texto of ['FORMA Y MEDIDAS GENERALES', 'FRENTES PARA CORTAR', 'EQUIPAMIENTO', 'abre a la izquierda', 'Cajón 1 (arriba)', 'A gas, 4 platos', 'Doble (2 cubetas)', 'Frente del especiero']) {
      expect(t).toContain(texto);
    }
  });
});


describe('hoja para el maestro de un proyecto con isla', () => {
  it('lleva las secciones y el esquema de la isla con su nombre, y el PDF se arma', async () => {
    const { nuevoAdicional, detalleProyecto } = await import('../shared/proyecto');
    const base = cocinaEnL();
    const isla = nuevoAdicional(base, 'isla');
    const p = { ...base, adicionales: [isla] };
    const c = contenidoHoja(p, producto, 'cm', materiales);
    expect(c.ficha.secciones.some((s) => s.titulo.startsWith('Isla · '))).toBe(true);
    expect(c.muros.some((m) => m.titulo.startsWith('Isla · '))).toBe(true);
    const detalle = detalleProyecto(p, producto, 'cm', materiales);
    expect(detalle.find((l) => l.etiqueta === 'Isla')?.valor).toContain('150 × 90 × 90 cm');
    const doc = crearHojaMaestro({
      marca: 'dto',
      numero: 'COT-0099',
      cliente: { nombre: 'Cliente', telefono: null, email: null, direccion: null },
      fecha: '2026-10-28',
      vendedor: 'Camila',
      modelo: 'Cocina + Isla',
      imagen: JPEG,
      diseno: p,
      producto,
      materiales,
      unidad: 'cm',
      observaciones: null,
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
