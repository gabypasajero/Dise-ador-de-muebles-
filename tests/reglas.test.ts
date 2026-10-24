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
  ejecutar,
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
import { validarDiseno } from '../shared/validar';
import { conCajoneras } from './cocinas';
import type { Diseno, ProductoTienda } from '../shared/tipos';

const suma = (d: Diseno) => d.cuerpos.reduce((s, c) => s + c.ancho, 0) + d.separacionCuerpos * (d.cuerpos.length - 1);
const moduloDe = (d: Diseno, tipo: 'encimera' | 'lavaplatos') => d.equipos.find((e) => e.tipo === tipo)!.modulo;
const indiceDe = (d: Diseno, tipo: 'encimera' | 'lavaplatos') => d.cuerpos.findIndex((c) => c.id === moduloDe(d, tipo));

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
    expect(validarDiseno(d)).toEqual([]);
  });

  it('fijarAncho respeta los límites del tipo de mueble', () => {
    expect(fijarAncho(disenoLibre('closet'), 99999).ancho).toBe(LIMITES.closet.ancho[1]);
    const chico = fijarAncho(disenoLibre('cocina'), 10);
    expect(chico.ancho).toBeGreaterThanOrEqual(LIMITES.cocina.ancho[0]);
    chico.cuerpos.forEach((c) => expect(c.ancho).toBeGreaterThanOrEqual(150));
    // La cocina full equipo no llega a 3,6 m: la cajonera mide hasta 90 cm y se avisa por qué.
    const r = ejecutar(disenoLibre('cocina'), { op: 'fijarAncho', ancho: 3600 });
    expect(r.ok).toBe(true);
    expect(r.diseno.ancho).toBe(3600);
    expect(validarDiseno(r.diseno)).toEqual([]);
  });

  it('cambiar el ancho de un cuerpo no cambia el ancho total: lo compensan sus vecinos ajustables', () => {
    // Full equipo + una puerta (agrandando el mueble): [horno 60][cajonera 45][puerta 45 + lavaplatos][puerta 35].
    const base = agregarModulo(disenoLibre('cocina'), presetsModulo('cocina')[0], undefined, 'base', true);
    expect(base.cuerpos.map((c) => c.ancho)).toEqual([600, 450, 450, 350]);
    const d = fijarAnchoCuerpo(base, 1, 600);
    expect(d.ancho).toBe(base.ancho);
    expect(suma(d)).toBe(d.ancho);
    // El horno es fijo; el módulo del lavaplatos es ajustable y, por ser el vecino, cede él.
    expect(d.cuerpos.map((c) => c.ancho)).toEqual([600, 600, 300, 350]);
    // En la full equipo cede el módulo del lavaplatos; el total no cambia.
    const r = ejecutar(disenoLibre('cocina'), { op: 'fijarAnchoModulo', tramo: 'base', modulo: 1, ancho: 600 });
    expect(r.ok).toBe(true);
    expect(r.diseno.cuerpos.map((c) => c.ancho)).toEqual([600, 600, 300]);
    expect(r.diseno.ancho).toBe(1500);
    expect(validarDiseno(r.diseno)).toEqual([]);
    // Si el vecino no alcanza, cede también la puerta del final.
    const todo = ejecutar(base, { op: 'fijarAnchoModulo', tramo: 'base', modulo: 1, ancho: 900 });
    expect(todo.ok).toBe(true);
    expect(todo.diseno.cuerpos.map((c) => c.ancho)).toEqual([600, 900, 150, 200]);
    expect(suma(todo.diseno)).toBe(base.ancho);
  });

  it('la separación entre cuerpos se descuenta de los módulos: el ancho no cambia', () => {
    const base = disenoLibre('cocina');
    const d = fijarSeparacion(base, 20);
    expect(d.ancho).toBe(base.ancho);
    expect(d.separacionCuerpos).toBe(20);
    expect(suma(d)).toBe(d.ancho);
  });

  it('agregar y quitar cuerpos mantiene la consistencia', () => {
    const d0 = conCajoneras(fijarAncho(disenoLibre('cocina'), 2400));
    let d = agregarCuerpo(d0, 'hueco');
    expect(d.cuerpos.at(-1)).toMatchObject({ tipo: 'hueco', ancho: 500 });
    expect(suma(d)).toBe(d.ancho);
    expect(d.ancho).toBe(d0.ancho);
    d = quitarCuerpo(d, d.cuerpos.length - 1);
    expect(d.cuerpos.map((c) => c.ancho)).toEqual(d0.cuerpos.map((c) => c.ancho));
    expect(suma(d)).toBe(d.ancho);
    expect(d.ancho).toBe(d0.ancho);
    expect(validarDiseno(d)).toEqual([]);
  });

  it('agrega un módulo entre otros dos y la encimera y el lavaplatos siguen en su módulo', () => {
    const d = conCajoneras(fijarAncho(disenoLibre('cocina'), 2400), [900, 900]);
    const enc = moduloDe(d, 'encimera');
    const lav = moduloDe(d, 'lavaplatos');
    const cajonera = presetsModulo('cocina').find((p) => p.id === 'cajonera')!;
    const m = agregarModulo(d, cajonera, 1);
    expect(m.cuerpos).toHaveLength(d.cuerpos.length + 1);
    // Las cajoneras (la nueva y las que había) se reparten parejo; el horno y el lavaplatos conservan su ancho.
    expect(m.cuerpos.map((c) => c.ancho)).toEqual([600, 675, 675, 900, 675, 675]);
    expect(m.cuerpos[1]).toMatchObject({ tipo: 'frentes', cajones: 3, ancho: 675 });
    expect(m.cuerpos[0].id).toBe(d.cuerpos[0].id);
    expect(moduloDe(m, 'encimera')).toBe(enc);
    expect(moduloDe(m, 'lavaplatos')).toBe(lav);
    expect(m.ancho).toBe(d.ancho);
    expect(suma(m)).toBe(m.ancho);
  });

  it('un módulo de puertas nuevo conserva sus 35 cm y lo absorben primero las cajoneras', () => {
    const d = disenoLibre('cocina');
    const puerta = presetsModulo('cocina')[0];
    // [horno 60][cajonera 45][puerta 45 + lavaplatos]: sin cajoneras que puedan ceder (nivel 1), ceden la cajonera
    // y el módulo del lavaplatos (nivel 3, hasta su mínimo) y la puerta nueva entra con 35 cm.
    expect(anchoDisponible(d, 'frentes', puerta.ancho)).toBe(350);
    const chica = agregarModulo(d, puerta);
    expect(chica.cuerpos.map((x) => x.ancho)).toEqual([600, 300, 300, 300]);
    expect(chica.ancho).toBe(d.ancho);
    expect(validarDiseno(chica)).toEqual([]);
    const c = conCajoneras(d, [900, 900]);
    expect(anchoDisponible(c, 'frentes', puerta.ancho)).toBe(350);
    const m = agregarModulo(c, puerta);
    expect(m.ancho).toBe(c.ancho);
    // La cajonera de 45 cm puede crecer hasta 90: las tres se reparten parejo.
    expect(m.cuerpos.map((x) => x.ancho)).toEqual([600, 634, 450, 633, 633, 350]);
    // Con ajustarLargo el mueble crece (hasta su máximo).
    const grande = agregarModulo(d, puerta, undefined, 'base', true);
    expect(grande.ancho).toBe(d.ancho + 350);
  });

  it('cada módulo disponible genera un diseño válido en todos los muebles', () => {
    for (const plantilla of ['cocina', 'compacto', 'cocina-infantil', 'closet', 'comoda', 'escritorio'] as const) {
      const presets = presetsModulo(plantilla);
      expect(presets.length).toBeGreaterThan(0);
      for (const p of presets) {
        // En las cocinas solo ceden las cajoneras: se parte de un diseño que las tiene.
        const libre = disenoLibre(plantilla);
        const base = plantilla === 'cocina' || plantilla === 'compacto' ? conCajoneras(libre) : fijarAncho(libre, LIMITES[plantilla].ancho[1]);
        const m = agregarModulo(base, p, 0);
        expect(m, `${plantilla} ${p.id}`).not.toBe(base);
        // En la cocina infantil nada va delante de la despensa: queda en la posición 1.
        const i = plantilla === 'cocina-infantil' ? 1 : 0;
        expect(m.cuerpos[i].tipo).toBe(p.tipo);
        expect(suma(m)).toBe(m.ancho);
        expect(validarDiseno(m), `${plantilla} ${p.id}`).toEqual([]);
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
    const r = ejecutar(d, { op: 'quitarModulo', tramo: 'base', modulo: indiceDe(d, 'lavaplatos') });
    const m = r.diseno;
    expect(indiceDe(m, 'lavaplatos')).not.toBe(indiceDe(m, 'encimera'));
    expect(m.cuerpos[indiceDe(m, 'lavaplatos')].tipo).toBe('frentes');
    expect(moduloDe(m, 'encimera')).toBe(moduloDe(d, 'encimera'));
    expect(m.ancho).toBe(d.ancho);
    expect(r.avisos.some((a) => a.includes('El lavaplatos simple pasó al módulo 2'))).toBe(true);
  });

  it('quitar un módulo reubica la encimera y no deja el mueble bajo el ancho mínimo', () => {
    let d = conCajoneras(fijarAncho(disenoLibre('cocina'), 2400), [600, 600]);
    d = actualizarCuerpo(d, 0, { tipo: 'frentes', puertas: 2 });
    const lav = moduloDe(d, 'lavaplatos');
    const m = quitarCuerpo(d, 0);
    expect(m.ancho).toBe(d.ancho);
    expect(indiceDe(m, 'encimera')).toBeGreaterThanOrEqual(0);
    expect(moduloDe(m, 'lavaplatos')).toBe(lav);
    expect(validarDiseno(m)).toEqual([]);
    // Quitar achicando el mueble no lo deja bajo su ancho mínimo (40 cm).
    const productos = JSON.parse(fs.readFileSync('public/datos/productos-respaldo.json', 'utf8')) as ProductoTienda[];
    let chico = disenoInicial(clasificarProducto(productos.find((x) => x.id === 42)!));
    chico = fijarAncho(agregarModulo(chico, presetsModulo('cocina')[0], undefined, 'base', true), 400);
    expect(chico.cuerpos.map((c) => c.ancho)).toEqual([250, 150]);
    const r = ejecutar(chico, { op: 'quitarModulo', tramo: 'base', modulo: 1, ajustarLargo: true });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/ancho mínimo/);
    // Sin ajustarLargo el espacio pasa al módulo de la encimera (nivel 3: los equipados también toman espacio).
    const sinAjuste = ejecutar(chico, { op: 'quitarModulo', tramo: 'base', modulo: 1 });
    expect(sinAjuste.ok).toBe(true);
    expect(sinAjuste.diseno.ancho).toBe(400);
    expect(sinAjuste.diseno.cuerpos.map((c) => c.ancho)).toEqual([400]);
    expect(validarDiseno(sinAjuste.diseno)).toEqual([]);
  });

  it('cambiar el ancho de un módulo no cambia el ancho total del mueble', () => {
    const d = agregarModulo(fijarAncho(disenoLibre('cocina'), 2400), presetsModulo('cocina')[1], undefined, 'base', true);
    const m = actualizarCuerpo(d, 1, { ancho: d.cuerpos[1].ancho - 150 });
    expect(m.cuerpos[1].ancho).toBe(d.cuerpos[1].ancho - 150);
    expect(m.ancho).toBe(d.ancho);
    expect(suma(m)).toBe(m.ancho);
  });

  it('el horno empotrado solo se agrega si caben 60 cm', () => {
    const horno = presetsModulo('cocina').find((p) => p.id === 'horno')!;
    const d = disenoLibre('cocina');
    // En la full equipo de 150 cm cabe uno (los ajustables bajan a su mínimo); otro ya no.
    const uno = agregarModulo(d, horno);
    expect(uno.cuerpos.map((c) => c.ancho)).toEqual([600, 150, 150, 600]);
    expect(agregarModulo(uno, horno)).toBe(uno);
    expect(ejecutar(uno, { op: 'agregarModulo', tramo: 'base', preset: 'horno' }).motivo).toMatch(/^No cabe «Horno empotrado» .* Faltan 60 cm/);
    const holgado = conCajoneras(fijarAncho(disenoLibre('cocina'), 2400));
    expect(agregarModulo(holgado, horno).cuerpos.at(-1)).toMatchObject({ tipo: 'horno', ancho: 600 });
  });

  it('cocina infantil: la despensa alta sigue siendo el primer módulo', () => {
    const d = fijarAncho(disenoLibre('cocina-infantil'), 1400);
    const despensa = d.cuerpos[0].id;
    const [puerta] = presetsModulo('cocina-infantil');
    const m = agregarModulo(d, puerta, 0);
    expect(m.cuerpos[0].id).toBe(despensa);
    // Todos los módulos son ajustables (también los de la encimera y el lavaplatos): se reparten parejo.
    expect(m.cuerpos.map((c) => c.ancho)).toEqual([350, 350, 350, 350]);
    expect(suma(m)).toBe(d.ancho);
    expect(moverCuerpo(m, 1, -1)).toBe(m);
    expect(moverCuerpo(m, 0, 1)).toBe(m);
    // Al quitar el módulo del lavaplatos o de la encimera, no pasan a la despensa.
    for (let i = 1; i < m.cuerpos.length; i++) {
      const q = quitarCuerpo(m, i);
      expect(indiceDe(q, 'encimera')).toBeGreaterThanOrEqual(1);
      expect(indiceDe(q, 'lavaplatos')).toBeGreaterThanOrEqual(1);
    }
  });

  it('la cómoda solo ofrece módulos de cajones', () => {
    expect(presetsModulo('comoda').map((p) => p.id)).toEqual(['cajones']);
  });

  it('nombra los módulos según lo que tienen', () => {
    const d = conCajoneras(fijarAncho(disenoLibre('cocina'), 3000));
    const preset = (id: string) => presetsModulo('cocina').find((p) => p.id === id)!;
    const nombres = ['puerta', 'cajonera', 'cajon-puerta', 'horno', 'hueco', 'especiero'].map((id) => nombreModulo(agregarModulo(d, preset(id), 0).cuerpos[0]));
    expect(nombres).toEqual(['1 puerta', '3 cajones', '1 cajón + 1 puerta', 'Horno', 'Espacio libre', 'Especiero 2 pisos']);
    expect(nombreModulo({ ...d.cuerpos[0], tipo: 'frentes', puertas: 0, cajones: 0 })).toBe('Abierto');
  });

  it('mover un cuerpo arrastra la encimera y el lavaplatos asignados', () => {
    const d = disenoLibre('cocina');
    const m = moverCuerpo(d, 0, 1);
    expect(m.cuerpos[1].id).toBe(d.cuerpos[0].id);
    expect(indiceDe(m, 'encimera')).toBe(1);
    expect(m.ancho).toBe(d.ancho);
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
    expect(n.ancho).toBe(1234);
  });
});

describe('advertencias de fabricación', () => {
  it('avisa cuando una puerta es demasiado ancha', () => {
    const d = actualizarCuerpo(fijarAncho(disenoLibre('closet'), 2400), 1, { puertas: 1 });
    expect(advertencias(d).some((a) => a.texto.includes('dividirla en 2 puertas'))).toBe(true);
  });
  it('avisa si encimera y lavaplatos van en el mismo módulo', () => {
    const d = disenoLibre('cocina');
    const mismo = { ...d, equipos: d.equipos.map((e) => (e.tipo === 'lavaplatos' ? { ...e, modulo: moduloDe(d, 'encimera') } : e)) };
    // Sobre el horno no va un lavaplatos: el mismo módulo de frentes sí avisa.
    const conFrentes = { ...d, equipos: d.equipos.map((e) => (e.tipo === 'encimera' ? { ...e, modulo: moduloDe(d, 'lavaplatos') } : e)) };
    expect(advertencias(conFrentes).some((a) => a.texto.includes('mismo módulo'))).toBe(true);
    expect(validarDiseno(mismo).some((p) => p.includes('lavaplatos sobre un horno'))).toBe(true);
  });
});

describe('precio y resumen', () => {
  const productos = JSON.parse(fs.readFileSync('public/datos/productos-respaldo.json', 'utf8')) as ProductoTienda[];
  const p = clasificarProducto(productos.find((x) => x.id === 16)!);
  const base = disenoInicial(p);

  it('la cocina usa el precio oficial de la tienda: la full equipo da $551.000', () => {
    expect(precioReferencial(base, p, base)).toBe(551000);
    expect(precioReferencial(base, null, null)).toBe(551000);
  });

  it('un mueble más ancho cuesta más', () => {
    const grande = fijarAncho(base, 2000);
    expect(precioReferencial(grande, p, base)!).toBeGreaterThan(551000);
  });

  it('los demás muebles conservan el precio referencial', () => {
    const closet = clasificarProducto(productos.find((x) => x.id === 152)!);
    const d = disenoInicial(closet);
    expect(precioReferencial(d, closet, d)).toBe(closet.precio_oferta ?? closet.precio);
  });

  it('el detalle en lista incluye medidas, distribución y equipamiento', () => {
    const detalle = detalleCotizacion(base, p, 'cm', null);
    const medidas = detalle.find((l) => l.etiqueta === 'Medidas')!;
    expect(medidas.valor).toContain('150 × 90 × 60 cm');
    expect(detalle.find((l) => l.etiqueta === 'Modelo base')!.valor).toContain('código 16');
    expect(detalle.find((l) => l.etiqueta === 'Distribución')!.sub).toHaveLength(3);
    const eq = detalle.find((l) => l.etiqueta === 'Equipamiento')!.valor;
    expect(eq).toContain('encimera 4 platos (módulo 1)');
    expect(eq).toContain('horno eléctrico 58 L (módulo 1)');
    expect(eq).toContain('lavaplatos 1 cubeta con secador (módulo 3), llave negro mate');
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
