import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial, disenoLibre } from '../shared/catalogo';
import {
  LIMITES,
  aUnidad,
  actualizarCuerpo,
  advertencias,
  agregarCuerpo,
  deUnidad,
  fijarAlto,
  fijarAncho,
  fijarAnchoCuerpo,
  fijarSeparacion,
  formatear,
  moverCuerpo,
  normalizar,
  precioReferencial,
  quitarCuerpo,
} from '../shared/reglas';
import { detalleCotizacion, formatoFecha, telefonoWhatsapp, textoCotizacion } from '../shared/resumen';
import type { Diseno, ProductoTienda } from '../shared/tipos';

const suma = (d: Diseno) => d.cuerpos.reduce((s, c) => s + c.ancho, 0) + d.separacionCuerpos * (d.cuerpos.length - 1);

describe('unidades', () => {
  it('convierte entre mm y cm', () => {
    expect(aUnidad(1505, 'cm')).toBe(150.5);
    expect(aUnidad(1505, 'mm')).toBe(1505);
    expect(deUnidad(150.5, 'cm')).toBe(1505);
    expect(deUnidad(1505, 'mm')).toBe(1505);
  });
  it('formatea con coma decimal chilena', () => {
    expect(formatear(1505, 'cm')).toBe('150,5 cm');
    expect(formatear(1500, 'cm')).toBe('150 cm');
    expect(formatear(1500, 'mm')).toBe('1500 mm');
  });
});

describe('operaciones sobre el diseño', () => {
  it('fijarAncho reparte el nuevo ancho y mantiene la suma', () => {
    const d = fijarAncho(disenoLibre('cocina'), 2000);
    expect(d.ancho).toBe(2000);
    expect(suma(d)).toBe(2000);
  });

  it('fijarAncho respeta los límites del tipo de mueble', () => {
    expect(fijarAncho(disenoLibre('cocina'), 99999).ancho).toBe(LIMITES.cocina.ancho[1]);
    const chico = fijarAncho(disenoLibre('cocina'), 10);
    expect(chico.ancho).toBeGreaterThanOrEqual(LIMITES.cocina.ancho[0]);
    chico.cuerpos.forEach((c) => expect(c.ancho).toBeGreaterThanOrEqual(150));
  });

  it('cambiar el ancho de un cuerpo actualiza el ancho total', () => {
    const d = fijarAnchoCuerpo(disenoLibre('cocina'), 1, 600);
    expect(d.cuerpos[1].ancho).toBe(600);
    expect(d.ancho).toBe(suma(d));
  });

  it('la separación entre cuerpos se suma al ancho', () => {
    const base = disenoLibre('cocina');
    const d = fijarSeparacion(base, 20);
    expect(d.ancho).toBe(base.ancho + 20 * (base.cuerpos.length - 1));
    expect(suma(d)).toBe(d.ancho);
  });

  it('agregar y quitar cuerpos mantiene la consistencia', () => {
    let d = agregarCuerpo(disenoLibre('cocina'), 'hueco');
    expect(d.cuerpos.at(-1)!.tipo).toBe('hueco');
    expect(suma(d)).toBe(d.ancho);
    d = quitarCuerpo(d, 0);
    expect(suma(d)).toBe(d.ancho);
    expect(d.cocina.encimeraCuerpo).toBeLessThan(d.cuerpos.length);
  });

  it('mover un cuerpo arrastra la encimera y el lavaplatos asignados', () => {
    const d = disenoLibre('cocina');
    const m = moverCuerpo(d, 0, 1);
    expect(m.cuerpos[1].id).toBe(d.cuerpos[0].id);
    expect(m.cocina.encimeraCuerpo).toBe(1);
  });

  it('actualizarCuerpo limita puertas y cajones', () => {
    const d = actualizarCuerpo(disenoLibre('closet'), 0, { puertas: 9, cajones: -2 });
    expect(d.cuerpos[0].puertas).toBe(4);
    expect(d.cuerpos[0].cajones).toBe(0);
  });

  it('fijarAlto no deja la cubierta del tocador fuera del mueble', () => {
    const d = fijarAlto(disenoLibre('tocador'), 1000);
    expect(d.tocador.altoCubierta).toBeLessThanOrEqual(600);
  });

  it('normalizar corrige un diseño inconsistente', () => {
    const d = { ...disenoLibre('closet'), ancho: 1234 };
    const n = normalizar(d);
    expect(suma(n)).toBe(n.ancho);
  });
});

describe('advertencias de fabricación', () => {
  it('avisa cuando una puerta es demasiado ancha', () => {
    const d = actualizarCuerpo(fijarAncho(disenoLibre('closet'), 2400), 1, { puertas: 1 });
    expect(advertencias(d).some((a) => a.texto.includes('dividirla en 2 puertas'))).toBe(true);
  });
  it('avisa si encimera y lavaplatos van en el mismo cuerpo', () => {
    const d = disenoLibre('cocina');
    d.cocina.lavaplatosCuerpo = d.cocina.encimeraCuerpo;
    expect(advertencias(d).some((a) => a.texto.includes('mismo cuerpo'))).toBe(true);
  });
});

describe('precio referencial y resumen', () => {
  const productos = JSON.parse(fs.readFileSync('public/datos/productos-respaldo.json', 'utf8')) as ProductoTienda[];
  const p = clasificarProducto(productos.find((x) => x.id === 16)!);
  const base = disenoInicial(p);

  it('sin cambios coincide con el precio de la tienda', () => {
    expect(precioReferencial(base, p, base)).toBe(p.precio_oferta);
  });

  it('un mueble más ancho cuesta más', () => {
    const grande = fijarAncho(base, 2000);
    expect(precioReferencial(grande, p, base)!).toBeGreaterThan(p.precio_oferta!);
  });

  it('el detalle en lista incluye medidas, distribución y equipamiento', () => {
    const detalle = detalleCotizacion(base, p, 'cm', null);
    const medidas = detalle.find((l) => l.etiqueta === 'Medidas')!;
    expect(medidas.valor).toContain('150 × 90 × 60 cm');
    expect(detalle.find((l) => l.etiqueta === 'Modelo base')!.valor).toContain('código 16');
    expect(detalle.find((l) => l.etiqueta === 'Distribución')!.sub).toHaveLength(3);
    expect(detalle.find((l) => l.etiqueta === 'Equipamiento')!.valor).toContain('encimera 4 platos');
  });

  it('el texto de la cotización termina con vendedor, fecha y valor del mueble', () => {
    const texto = textoCotizacion({
      numero: 'COT-0007',
      cliente: { nombre: 'Fernando Pérez', telefono: '+56 9 1234 5678', email: null, direccion: 'Maipú' },
      detalle: detalleCotizacion(base, p, 'cm', null),
      observaciones: null,
      vendedor: { id: 'a1', nombre: 'Camila Rojas', telefono: null },
      fecha: '2026-10-13',
      valor: 519990,
    });
    const lineas = texto.split('\n');
    expect(lineas[0]).toBe('Cotización Fernando Pérez · N° COT-0007');
    expect(lineas.slice(-3)).toEqual(['Vendedor: Camila Rojas', 'Fecha cotización: 13-10-2026', 'Valor mueble: $519.990']);
    expect(texto).toContain('• Dirección / comuna: Maipú');
  });
});

describe('utilidades de cotización', () => {
  it('formatea fechas como DD-MM-AAAA', () => {
    expect(formatoFecha('2026-10-13')).toBe('13-10-2026');
  });
  it('normaliza teléfonos chilenos para WhatsApp', () => {
    expect(telefonoWhatsapp('+56 9 1234 5678')).toBe('56912345678');
    expect(telefonoWhatsapp('9 1234 5678')).toBe('56912345678');
    expect(telefonoWhatsapp('1234 5678')).toBe('56912345678');
    expect(telefonoWhatsapp('123')).toBeNull();
    expect(telefonoWhatsapp(null)).toBeNull();
  });
});
