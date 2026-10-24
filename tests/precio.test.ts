// Precio oficial de la cocina (lineal, L y U) con su desglose.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial, disenoLibre } from '../shared/catalogo';
import {
  activarAereos,
  agregarEquipo,
  agregarModulo,
  configurarEquipo,
  ejecutar,
  fijarAereos,
  fijarAncho,
  fijarForma,
  fijarLado,
  fijarLadoAereo,
  fijarProfundidad,
  precioDiseno,
  precioReferencial,
  presetsModulo,
  quitarEquipo,
} from '../shared/reglas';
import { excesoAereo, largoAereo, precioCocina, recargoAereo, TARIFAS, valorMetro } from '../shared/tarifas';
import type { Diseno, ProductoTienda } from '../shared/tipos';

const productos = JSON.parse(fs.readFileSync('public/datos/productos-respaldo.json', 'utf8')) as ProductoTienda[];
const prod = (id: number) => clasificarProducto(productos.find((x) => x.id === id)!);
const full = () => disenoInicial(prod(16));
const valor = (d: Diseno, concepto: string) => precioCocina(d).lineas.filter((l) => l.concepto === concepto).reduce((s, l) => s + l.valor, 0);
/** Equipamiento de la full equipo: encimera 4 + horno + lavaplatos simple + llave. */
const EQUIPO_FULL = 85000 + 170000 + 40000 + 16000;
/** La misma cocina con encimera de 3 hornillas: el metro se cobra con su fondo real. */
const full3 = (): Diseno => {
  const d = full();
  for (const e of d.equipos) if (e.tipo === 'encimera') e.platos = '3';
  return d;
};
const EQUIPO_FULL3 = 60000 + 170000 + 40000 + 16000;

describe('valor por metro según el fondo', () => {
  it('redondea siempre al tramo mayor', () => {
    const casos: [number, number][] = [
      [35, 135000],
      [40, 135000],
      [45, 140000],
      [50, 140000],
      [55, 150000],
      [57, 160000],
      [60, 160000],
      [61, 170000],
      [65, 170000],
      [66, 170000],
      [70, 170000],
      [71, 180000],
      [75, 180000],
      [76, 190000],
      [80, 190000],
    ];
    for (const [fondoCm, esperado] of casos) expect(valorMetro(fondoCm * 10), `${fondoCm} cm`).toBe(esperado);
    // Medidas con decimales: 40,5 cm ya cobra el tramo de 50 y 60,1 cm el de 70.
    expect(valorMetro(405)).toBe(140000);
    expect(valorMetro(601)).toBe(170000);
  });
});

describe('recargo del aéreo', () => {
  it('cada exceso se redondea a 5 cm: $15.000 por cada 10 cm y $10.000 si quedan 5', () => {
    expect([50, 100, 150, 200, 250].map(recargoAereo)).toEqual([10000, 15000, 25000, 30000, 40000]);
    expect(excesoAereo(600, 60)).toBe(0);
    expect(excesoAereo(550, 60)).toBe(0);
    expect(excesoAereo(601, 60)).toBe(50);
    expect(excesoAereo(660, 60)).toBe(100);
    expect(excesoAereo(330, 30)).toBe(50);
  });
});

describe('precio oficial de la cocina', () => {
  it('la «Cocina full equipo» de la tienda da $551.000 con su desglose', () => {
    const d = full();
    const p = precioCocina(d);
    expect(p.total).toBe(1.5 * 160000 + 85000 + 170000 + 40000 + 16000);
    expect(p.total).toBe(551000);
    expect(p.lineas.map((l) => [l.concepto, l.valor])).toEqual([
      ['Mueble base', 240000],
      ['Encimera 4 platos', 85000],
      ['Horno eléctrico 58 L Sindelen', 170000],
      ['Lavaplatos simple', 40000],
      ['Llave monomando', 16000],
    ]);
    expect(p.lineas[0]).toMatchObject({ cantidad: 1.5, unidad: 'm', unitario: 160000 });
    expect(p.lineas[0].detalle).toContain('fondo 60 cm');
    expect(precioDiseno(d, null, null)).toMatchObject({ total: 551000, metodo: 'oficial' });
  });

  it('cobra cada metro según el fondo de cada fondo de prueba', () => {
    for (const [fondo, porMetro] of [
      [450, 140000],
      [500, 140000],
      [550, 150000],
      [570, 160000],
      [600, 160000],
      [650, 170000],
      [660, 170000],
      [700, 170000],
      [750, 180000],
    ]) {
      const d = fijarProfundidad(full3(), fondo);
      expect(precioCocina(d).total, `fondo ${fondo}`).toBe(1.5 * porMetro + EQUIPO_FULL3);
    }
  });

  it('en la L cada lado se cobra completo, sin descontar la esquina (210 + 120 cm)', () => {
    const d = fijarForma(full3(), 'der');
    // Tramo principal de 150 cm de módulos + 60 de esquina = 210; el lado mide 120 desde el muro.
    expect(d.ancho + d.lados.der!.profundidad).toBe(2100);
    expect(d.lados.der!.largo).toBe(1200);
    expect(valor(d, 'Mueble base · tramo principal')).toBe(2.1 * 160000);
    expect(valor(d, 'Mueble base · lado derecho')).toBe(1.2 * 160000);
    expect(precioCocina(d).total).toBe(2.1 * 160000 + 1.2 * 160000 + EQUIPO_FULL3);
    // Si el lado tiene otro fondo, se cobra con el suyo.
    const angosto = fijarLado(d, 'der', { profundidad: 500 });
    expect(valor(angosto, 'Mueble base · lado derecho')).toBe(1.2 * 140000);
    expect(valor(angosto, 'Mueble base · tramo principal')).toBe(2.0 * 160000);
  });

  it('en la U se cobran los tres lados completos', () => {
    let d = fijarForma(fijarAncho(full(), 2400), 'U');
    d = fijarLado(d, 'izq', { largo: 1500 });
    const [principal, izq, der] = [d.ancho + 600 + 600, 1500, 1200];
    expect(precioCocina(d).total).toBe((principal / 1000) * 160000 + (izq / 1000) * 160000 + (der / 1000) * 160000 + EQUIPO_FULL);
  });

  it('el equipamiento se cobra por unidad: hornos, lavaplatos, llaves y campanas', () => {
    let d = fijarLado(fijarForma(fijarAncho(full(), 3000), 'U'), 'der', { largo: 1800 });
    const base = precioCocina(d).total;
    d = agregarEquipo(d, 'horno', { tramo: 'der' });
    expect(d.lados.der!.cuerpos.some((c) => c.tipo === 'horno')).toBe(true);
    expect(precioCocina(d).total - base).toBe(TARIFAS.horno);
    d = agregarEquipo(d, 'lavaplatos', { tramo: 'izq', modelo: 'doble' });
    expect(valor(d, 'Lavaplatos doble')).toBe(55000);
    expect(valor(d, 'Llave monomando')).toBe(2 * 16000);
    const lav = d.equipos.find((e) => e.tipo === 'lavaplatos' && e.modelo === 'doble')!;
    d = quitarEquipo(d, `${lav.id}:llave`);
    expect(valor(d, 'Llave monomando')).toBe(16000);
    d = agregarEquipo(d, 'campana');
    expect(valor(d, 'Campana')).toBe(70000);
    const enc = d.equipos.find((e) => e.tipo === 'encimera')!;
    d = configurarEquipo(d, enc.id, { platos: '3' });
    expect(valor(d, 'Encimera 3 platos')).toBe(60000);
    expect(valor(d, 'Encimera 4 platos')).toBe(0);
  });

  it('un diseño viejo con encimera de 2 platos se cobra como de 3', () => {
    const d = full();
    const viejo = { ...d, equipos: d.equipos.map((e) => (e.tipo === 'encimera' ? { ...e, platos: '2' as const } : e)) };
    expect(valor(viejo, 'Encimera 3 platos')).toBe(60000);
  });

  it('el especiero se cobra aparte: $20.000 por cada uno', () => {
    const d = fijarAncho(full(), 2400);
    const esp = presetsModulo('cocina').find((p) => p.id === 'especiero')!;
    const con = agregarModulo(d, esp, 1);
    expect(con.cuerpos.some((c) => c.tipo === 'especiero')).toBe(true);
    expect(TARIFAS.especiero).toBe(20000);
    expect(precioCocina(con).total).toBe(precioCocina(d).total + 20000);
    expect(precioCocina(con).lineas.find((l) => l.concepto === 'Especiero')).toMatchObject({ cantidad: 1, valor: 20000 });
    const dos = agregarModulo(con, esp, 3);
    expect(valor(dos, 'Especiero')).toBe(40000);
  });

  it('tabla de fondos: ejemplo de la dueña 1,60 m × fondo 55 = $240.000', () => {
    const d = fijarProfundidad(fijarAncho(full3(), 1600), 550);
    expect(valor(d, 'Mueble base')).toBe(240000);
    expect(valor(fijarProfundidad(d, 450), 'Mueble base')).toBe(1.6 * 140000);
    expect(valor(fijarProfundidad(d, 650), 'Mueble base')).toBe(1.6 * 170000);
    expect(valor(fijarProfundidad(d, 750), 'Mueble base')).toBe(1.6 * 180000);
  });

  it('con encimera de 4 hornillas el metro se cobra al menos con el fondo de 60 cm', () => {
    const d = fijarProfundidad(fijarAncho(full(), 1600), 550);
    expect(valor(d, 'Mueble base')).toBe(1.6 * 160000);
    expect(precioCocina(d).lineas[0].detalle).toMatch(/se cobra como fondo 60 cm por la encimera de 4 hornillas/);
    // Con fondo mayor a 60 cm se cobra su propio fondo.
    expect(valor(fijarProfundidad(d, 700), 'Mueble base')).toBe(1.6 * 170000);
  });

  it('la llave monomando vale $16.000', () => {
    expect(TARIFAS.llave).toBe(16000);
    expect(valor(full(), 'Llave monomando')).toBe(16000);
  });

  it('cierre suave y sin manilla se cobran una vez por mueble completo', () => {
    let d = fijarForma(fijarAncho(full(), 3000), 'U');
    const base = precioCocina(d).total;
    d = ejecutar(d, { op: 'fijarAcabados', cierreSuave: true, tirador: 'sin' }).diseno;
    expect(d.cierreSuave).toBe(true);
    expect(valor(d, 'Cierre suave en puertas y cajones')).toBe(30000);
    expect(valor(d, 'Sistema sin manilla')).toBe(20000);
    expect(precioCocina(d).total).toBe(base + 30000 + 20000);
    // No depende de la cantidad de módulos.
    const mas = agregarModulo(d, presetsModulo('cocina').find((p) => p.id === 'puerta')!, 0);
    expect(valor(mas, 'Cierre suave en puertas y cajones')).toBe(30000);
    expect(valor(mas, 'Sistema sin manilla')).toBe(20000);
  });

  it('el aéreo vale $130.000 por metro lineal (cada lado de la L/U a su largo completo)', () => {
    const lineal = activarAereos(full(), true);
    const m = largoAereo(lineal) / 1000;
    expect(m).toBeGreaterThan(0);
    expect(valor(lineal, 'Mueble aéreo')).toBe(Math.round(m * 130000));
    expect(precioCocina(lineal).total).toBe(551000 + Math.round(m * 130000));
    const linea = precioCocina(lineal).lineas.find((l) => l.concepto === 'Mueble aéreo')!;
    expect(linea.detalle).toContain('× $130.000 por metro');
    // 1,8 m de aéreo: 1,8 × 130.000 = 234.000.
    const a180 = structuredClone(lineal);
    a180.aereos.cuerpos = [{ ...a180.aereos.cuerpos[0], ancho: 1800 }];
    expect(largoAereo(a180)).toBe(1800);
    expect(valor(a180, 'Mueble aéreo')).toBe(234000);
    const u = activarAereos(fijarForma(fijarAncho(full(), 3000), 'U'), true);
    expect(u.aereos.lados.izq && u.aereos.lados.der).toBeTruthy();
    const largoU = u.aereos.cuerpos.reduce((s, c) => s + c.ancho, 0) + u.aereos.lados.izq!.largo + u.aereos.lados.der!.largo;
    expect(largoAereo(u)).toBe(largoU);
    expect(valor(u, 'Mueble aéreo')).toBe(Math.round((largoU * 130000) / 1000));
    expect(precioCocina(u).lineas.find((l) => l.concepto === 'Mueble aéreo')!.detalle).toContain('en U');
  });

  it('el aéreo suma por alto y por fondo sobre la base de 60 × 30 cm (el fondo mayor de sus lados)', () => {
    const a = activarAereos(full(), true);
    const extra = (d: Diseno) => valor(d, 'Aéreo: alto adicional') + valor(d, 'Aéreo: fondo adicional');
    expect(extra(a)).toBe(0);
    expect(extra(fijarAereos(a, { alto: 650 }))).toBe(10000);
    expect(extra(fijarAereos(a, { alto: 700 }))).toBe(15000);
    expect(extra(fijarAereos(a, { alto: 750 }))).toBe(25000);
    expect(extra(fijarAereos(a, { alto: 800 }))).toBe(30000);
    expect(extra(fijarAereos(a, { alto: 680 }))).toBe(15000);
    expect(extra(fijarAereos(a, { alto: 710 }))).toBe(25000);
    // Bajo la base no hay descuento.
    expect(extra(fijarAereos(a, { alto: 400, profundidad: 250 }))).toBe(0);
    expect(extra(fijarAereos(a, { profundidad: 350 }))).toBe(10000);
    expect(extra(fijarAereos(a, { alto: 700, profundidad: 400 }))).toBe(15000 + 15000);
    // En L se usa el fondo mayor de sus lados.
    const l = fijarLadoAereo(activarAereos(fijarForma(full(), 'izq'), true), 'izq', { profundidad: 450 });
    expect(l.aereos.profundidad).toBe(300);
    expect(valor(l, 'Aéreo: fondo adicional')).toBe(15000 + 10000);
  });

  it('el compacto y los demás muebles del catálogo valen el precio de la tienda con sus medidas', () => {
    for (const id of [153, 154]) {
      const p = prod(id);
      const d = disenoInicial(p);
      expect(precioReferencial(d, p, d)).toBe(Math.round((p.precio_oferta ?? p.precio) / 1000) * 1000 - 10);
      expect(precioDiseno(d, p, d)).toMatchObject({ metodo: 'oficial', total: p.precio_oferta ?? p.precio });
      expect(precioDiseno(d, p, d)!.lineas[0].concepto).toBe('Precio de la tienda');
    }
    const infantil = disenoLibre('cocina-infantil');
    expect(precioReferencial(infantil, null, null)).toBeNull();
  });

  it('las tarifas se editan en un solo lugar', () => {
    const antes = TARIFAS.horno;
    try {
      TARIFAS.horno = 200000;
      expect(precioCocina(full()).total).toBe(551000 + 30000);
    } finally {
      TARIFAS.horno = antes;
    }
    expect(precioCocina(full()).total).toBe(551000);
  });
});
