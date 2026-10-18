import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clasificarProducto, coloresDeVariante, disenoInicial, disenoLibre, leerMedidas } from '../shared/catalogo';
import { calcularLayout, calcularLayoutTocador } from '../shared/layout';
import type { Plantilla, ProductoTienda } from '../shared/tipos';

const productos = JSON.parse(fs.readFileSync('public/datos/productos-respaldo.json', 'utf8')) as ProductoTienda[];

describe('leerMedidas', () => {
  it('interpreta profundidad × ancho × alto en cm', () => {
    expect(leerMedidas('60 × 150 × 90 cm')).toEqual({ ancho: 1500, alto: 900, profundidad: 600 });
    expect(leerMedidas('37 x 70 x 78 cm')).toEqual({ ancho: 700, alto: 780, profundidad: 370 });
  });
  it('acepta milímetros y decimales con coma', () => {
    expect(leerMedidas('400 × 1130 × 1700 mm')).toEqual({ ancho: 1130, alto: 1700, profundidad: 400 });
    expect(leerMedidas('40,5 × 80 × 170 cm')).toEqual({ ancho: 800, alto: 1700, profundidad: 405 });
  });
  it('devuelve null si no hay tres medidas', () => {
    expect(leerMedidas(null)).toBeNull();
    expect(leerMedidas('consultar')).toBeNull();
  });
});

describe('clasificación del catálogo de la tienda', () => {
  it('asigna plantilla y escenario a todos los productos', () => {
    for (const p of productos) {
      const c = clasificarProducto(p);
      expect(['cocina', 'compacto', 'closet', 'comoda', 'tocador', 'escritorio', 'cocina-infantil']).toContain(c.plantilla);
      expect(c.medidasBase.ancho).toBeGreaterThan(0);
    }
  });

  it('las cocinas van al escenario cocina y los clósets a un dormitorio', () => {
    const cocina = clasificarProducto(productos.find((p) => p.id === 16)!);
    expect(cocina.plantilla).toBe('cocina');
    expect(cocina.escenario).toBe('cocina');
    expect(cocina.modelo).toBe('Cocina full equipo: horno, encimera y lavaplatos');
    expect(cocina.variante).toBe('Clasic Pino Casina');
    const closet = clasificarProducto(productos.find((p) => p.id === 152)!);
    expect(closet.plantilla).toBe('closet');
    expect(['dormitorio', 'infantil']).toContain(closet.escenario);
  });

  it('los compactos de la tienda se diseñan como cocina compacta con sus colores', () => {
    const c3 = clasificarProducto(productos.find((p) => /compacto 3C/i.test(p.nombre))!);
    expect(c3.plantilla).toBe('compacto');
    expect(c3.escenario).toBe('cocina');
    expect(c3.variante).toBe('Calacatta Verde Salvia');
    const c5 = clasificarProducto(productos.find((p) => /compacto 5C/i.test(p.nombre))!);
    expect(c5.plantilla).toBe('compacto');
    expect(c5.variante).toBe('Clasic Pino Nebraska');
    expect(coloresDeVariante('Calacatta Verde Salvia')).toEqual({ cubierta: 'calacatta', frente: 'verde-salvia' });
  });

  it('lee la combinación de colores de cocina desde el nombre', () => {
    expect(coloresDeVariante('Florentino Gris Blanqueado')).toEqual({ cubierta: 'florentino', frente: 'gris-blanqueado' });
    expect(coloresDeVariante('Granito Pino Nebraska')).toEqual({ cubierta: 'granito', frente: 'pino-nebraska' });
  });

  it('el diseño inicial de cada producto es consistente', () => {
    for (const p of productos) {
      const c = clasificarProducto(p);
      const d = disenoInicial(c);
      const suma = d.cuerpos.reduce((s, x) => s + x.ancho, 0) + d.separacionCuerpos * (d.cuerpos.length - 1);
      expect(suma, p.nombre).toBe(d.ancho);
      const frentes = d.plantilla === 'tocador' ? calcularLayoutTocador(d).frentes : calcularLayout(d).frentes;
      for (const f of frentes) {
        expect(f.rect.x1 - f.rect.x0, `${p.nombre} ancho frente`).toBeGreaterThan(50);
        expect(f.rect.y1 - f.rect.y0, `${p.nombre} alto frente`).toBeGreaterThan(50);
      }
    }
  });

  it('la cocina full equipo trae horno, 3 cajones, 1 puerta, encimera de 4 y lavaplatos', () => {
    const d = disenoInicial(clasificarProducto(productos.find((p) => p.id === 16)!));
    expect(d.cuerpos.map((c) => c.tipo)).toEqual(['horno', 'frentes', 'frentes']);
    expect(d.cuerpos[1].cajones).toBe(3);
    expect(d.cuerpos[2].puertas).toBe(1);
    expect(d.cocina.encimera).toBe('4');
    expect(d.cocina.lavaplatos).toBe('simple');
    expect(d.materiales).toMatchObject({ cubierta: 'clasic', frente: 'pino-casina' });
  });

  it('el clóset de 4 puertas se arma con 3 cuerpos', () => {
    const d = disenoInicial(clasificarProducto(productos.find((p) => p.id === 152)!));
    expect(d.cuerpos.map((c) => c.puertas)).toEqual([1, 2, 1]);
    expect(d.cuerpos[1].cajones).toBe(4);
    const l = calcularLayout(d);
    expect(l.frentes.filter((f) => f.tipo === 'puerta')).toHaveLength(4);
    expect(l.frentes.filter((f) => f.tipo === 'cajon')).toHaveLength(4);
  });

  it('se puede partir de cero con cada plantilla', () => {
    const plantillas: Plantilla[] = ['cocina', 'compacto', 'closet', 'comoda', 'tocador', 'escritorio', 'cocina-infantil'];
    for (const pl of plantillas) {
      const d = disenoLibre(pl);
      expect(d.plantilla).toBe(pl);
      expect(d.productoId).toBeNull();
      expect(d.cuerpos.length).toBeGreaterThan(0);
    }
  });
});
