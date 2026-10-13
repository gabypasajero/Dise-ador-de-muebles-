import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial, disenoLibre } from '../shared/catalogo';
import {
  LIMITES,
  aUnidad,
  actualizarCuerpo,
  advertencias,
  agregarCuerpo,
  agregarModulo,
  anchoDisponible,
  deUnidad,
  fijarAlto,
  fijarAncho,
  fijarAnchoCuerpo,
  fijarSeparacion,
  formatear,
  moverCuerpo,
  nombreModulo,
  normalizar,
  precioReferencial,
  presetsModulo,
  quitarCuerpo,
} from '../shared/reglas';
import { calcularLayout } from '../shared/layout';
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

  it('agrega un módulo entre otros dos y la encimera y el lavaplatos siguen en su módulo', () => {
    const d = disenoLibre('cocina');
    const enc = d.cuerpos[d.cocina.encimeraCuerpo].id;
    const lav = d.cuerpos[d.cocina.lavaplatosCuerpo].id;
    const cajonera = presetsModulo('cocina').find((p) => p.id === 'cajonera')!;
    const m = agregarModulo(d, cajonera, 1);
    expect(m.cuerpos).toHaveLength(d.cuerpos.length + 1);
    expect(m.cuerpos[1]).toMatchObject({ tipo: 'frentes', cajones: 3, ancho: 450 });
    expect(m.cuerpos[0].id).toBe(d.cuerpos[0].id);
    expect(m.cuerpos[m.cocina.encimeraCuerpo].id).toBe(enc);
    expect(m.cuerpos[m.cocina.lavaplatosCuerpo].id).toBe(lav);
    expect(m.ancho).toBe(d.ancho + 450);
    expect(suma(m)).toBe(m.ancho);
  });

  it('un módulo nuevo no pasa el ancho máximo: usa lo que queda o no se agrega', () => {
    const max = LIMITES.cocina.ancho[1];
    const d = fijarAncho(disenoLibre('cocina'), max - 200);
    const puerta = presetsModulo('cocina')[0];
    expect(anchoDisponible(d, 'frentes', 450)).toBe(200);
    const m = agregarModulo(d, puerta);
    expect(m.ancho).toBe(max);
    expect(m.cuerpos.at(-1)!.ancho).toBe(200);
    // Lleno: no cambia nada.
    expect(anchoDisponible(m, 'frentes', 450)).toBeNull();
    expect(agregarModulo(m, puerta)).toBe(m);
    // Los cuerpos existentes no se achican.
    m.cuerpos.slice(0, d.cuerpos.length).forEach((c, i) => expect(c.ancho).toBe(d.cuerpos[i].ancho));
  });

  it('cada módulo disponible genera un diseño válido en todos los muebles', () => {
    for (const plantilla of ['cocina', 'cocina-infantil', 'closet', 'comoda', 'escritorio'] as const) {
      const presets = presetsModulo(plantilla);
      expect(presets.length).toBeGreaterThan(0);
      for (const p of presets) {
        const base = disenoLibre(plantilla);
        const m = agregarModulo(base, p, 0);
        // En la cocina infantil nada va delante de la despensa: queda en la posición 1.
        const i = plantilla === 'cocina-infantil' ? 1 : 0;
        expect(m.cuerpos[i].tipo).toBe(p.tipo);
        expect(suma(m)).toBe(m.ancho);
        const l = calcularLayout(m);
        for (const f of l.frentes) {
          expect(Number.isFinite(f.rect.x0 + f.rect.x1 + f.rect.y0 + f.rect.y1)).toBe(true);
          expect(f.rect.x1).toBeGreaterThan(f.rect.x0);
          expect(f.rect.y1).toBeGreaterThan(f.rect.y0);
        }
        expect(nombreModulo(m.cuerpos[i]).length).toBeGreaterThan(0);
      }
    }
    expect(presetsModulo('tocador')).toEqual([]);
  });

  it('al quitar el módulo del lavaplatos, este pasa a otro módulo con frentes y no al de la encimera', () => {
    const d = disenoLibre('cocina');
    const m = quitarCuerpo(d, d.cocina.lavaplatosCuerpo);
    expect(m.cocina.lavaplatosCuerpo).not.toBe(m.cocina.encimeraCuerpo);
    expect(m.cuerpos[m.cocina.lavaplatosCuerpo].tipo).toBe('frentes');
    expect(m.cuerpos[m.cocina.encimeraCuerpo].id).toBe(d.cuerpos[d.cocina.encimeraCuerpo].id);
  });

  it('quitar un módulo reubica la encimera aunque el mueble quede bajo el ancho mínimo', () => {
    let d = disenoLibre('cocina');
    d = fijarAncho(d, LIMITES.cocina.ancho[0]);
    const lav = d.cuerpos[d.cocina.lavaplatosCuerpo].id;
    const m = quitarCuerpo(d, 0);
    expect(m.ancho).toBeGreaterThanOrEqual(LIMITES.cocina.ancho[0]);
    expect(m.cocina.encimeraCuerpo).toBeLessThan(m.cuerpos.length);
    if (d.cocina.lavaplatosCuerpo !== 0) expect(m.cuerpos[m.cocina.lavaplatosCuerpo].id).toBe(lav);
  });

  it('cambiar el ancho de un módulo cambia el ancho total del mueble', () => {
    const d = disenoLibre('cocina');
    const m = actualizarCuerpo(d, 1, { ancho: d.cuerpos[1].ancho + 150 });
    expect(m.cuerpos[1].ancho).toBe(d.cuerpos[1].ancho + 150);
    expect(m.ancho).toBe(d.ancho + 150);
    expect(suma(m)).toBe(m.ancho);
  });

  it('el horno empotrado solo se agrega si caben 60 cm', () => {
    const horno = presetsModulo('cocina').find((p) => p.id === 'horno')!;
    const d = fijarAncho(disenoLibre('cocina'), LIMITES.cocina.ancho[1] - 400);
    expect(agregarModulo(d, horno)).toBe(d);
    const holgado = fijarAncho(disenoLibre('cocina'), LIMITES.cocina.ancho[1] - 600);
    expect(agregarModulo(holgado, horno).cuerpos.at(-1)).toMatchObject({ tipo: 'horno', ancho: 600 });
  });

  it('cocina infantil: la despensa alta sigue siendo el primer módulo', () => {
    const d = disenoLibre('cocina-infantil');
    const despensa = d.cuerpos[0].id;
    const [puerta] = presetsModulo('cocina-infantil');
    const m = agregarModulo(d, puerta, 0);
    expect(m.cuerpos[0].id).toBe(despensa);
    expect(m.cuerpos[1].ancho).toBe(300);
    expect(moverCuerpo(m, 1, -1)).toBe(m);
    expect(moverCuerpo(m, 0, 1)).toBe(m);
    // Al quitar el módulo del lavaplatos o de la encimera, no pasan a la despensa.
    for (let i = 1; i < m.cuerpos.length; i++) {
      const q = quitarCuerpo(m, i);
      expect(q.cocina.encimeraCuerpo).toBeGreaterThanOrEqual(1);
      expect(q.cocina.lavaplatosCuerpo).toBeGreaterThanOrEqual(1);
    }
  });

  it('la cómoda solo ofrece módulos de cajones', () => {
    expect(presetsModulo('comoda').map((p) => p.id)).toEqual(['cajones']);
  });

  it('nombra los módulos según lo que tienen', () => {
    const d = disenoLibre('cocina');
    const preset = (id: string) => presetsModulo('cocina').find((p) => p.id === id)!;
    const nombres = ['puerta', 'cajonera', 'cajon-puerta', 'horno', 'hueco'].map((id) => nombreModulo(agregarModulo(d, preset(id), 0).cuerpos[0]));
    expect(nombres).toEqual(['1 puerta', '3 cajones', '1 cajón + 1 puerta', 'Horno', 'Espacio libre']);
    expect(nombreModulo({ ...d.cuerpos[0], tipo: 'frentes', puertas: 0, cajones: 0 })).toBe('Abierto');
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
  it('avisa si encimera y lavaplatos van en el mismo módulo', () => {
    const d = disenoLibre('cocina');
    d.cocina.lavaplatosCuerpo = d.cocina.encimeraCuerpo;
    expect(advertencias(d).some((a) => a.texto.includes('mismo módulo'))).toBe(true);
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
