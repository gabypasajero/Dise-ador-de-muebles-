// Cocina en L, muebles aéreos y cocina compacta.
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial, disenoLibre } from '../shared/catalogo';
import { calcularLayout, calcularLayoutAereos, dimensionesTotales, disenoRetorno, extremosPrincipal } from '../shared/layout';
import {
  ANCHO_HORNO,
  LIMITES_RETORNO,
  actualizarCuerpo,
  activarAereos,
  advertencias,
  agregarModulo,
  anchoDisponible,
  fijarAlto,
  fijarAncho,
  fijarAnchoCuerpo,
  fijarForma,
  fijarProfundidad,
  fijarRetorno,
  largoTramo,
  moverCuerpo,
  normalizar,
  precioReferencial,
  presetsModulo,
  quitarCuerpo,
} from '../shared/reglas';
import { detalleCotizacion } from '../shared/resumen';
import type { Diseno, ProductoTienda } from '../shared/tipos';

const producto = (nombre: string, medidas: string): ProductoTienda => ({
  id: 900,
  nombre,
  categoria: 'cocina',
  descripcion: null,
  medidas,
  precio: 129990,
  precio_oferta: null,
  imagen_url: null,
  personalizable: false,
  destacado: false,
  orden: 5,
});

const util = (d: Diseno) => d.retorno!.largo - d.profundidad;

describe('cocina en L', () => {
  it('agrega un tramo en L con sus módulos ocupando el largo exterior', () => {
    const d = fijarForma(disenoLibre('cocina'), 'der');
    expect(d.retorno).toMatchObject({ lado: 'der', largo: 1200, profundidad: d.profundidad });
    expect(largoTramo(d, 'retorno')).toBe(util(d));
    expect(fijarForma(d, null).retorno).toBeNull();
    // Solo las cocinas pueden tener L.
    expect(fijarForma(disenoLibre('closet'), 'der').retorno).toBeNull();
  });

  it('agregar, quitar y mover módulos de la L cambia su largo y no toca la encimera', () => {
    let d = fijarForma(disenoLibre('cocina'), 'izq');
    const enc = d.cocina.encimeraCuerpo;
    const cajonera = presetsModulo('cocina', 'retorno').find((p) => p.id === 'cajonera')!;
    d = agregarModulo(d, cajonera, 0, 'retorno');
    expect(d.retorno!.cuerpos[0]).toMatchObject({ cajones: 3, ancho: 450 });
    expect(d.retorno!.largo).toBe(1200 + 450);
    expect(largoTramo(d, 'retorno')).toBe(util(d));
    expect(d.cocina.encimeraCuerpo).toBe(enc);
    const m = moverCuerpo(d, 0, 1, 'retorno');
    expect(m.retorno!.cuerpos[1].id).toBe(d.retorno!.cuerpos[0].id);
    const q = quitarCuerpo(m, 1, 'retorno');
    expect(q.retorno!.cuerpos).toHaveLength(1);
    expect(largoTramo(q, 'retorno')).toBe(util(q));
  });

  it('el largo exterior se conserva al cambiar el fondo del tramo principal', () => {
    const d = fijarProfundidad(fijarForma(disenoLibre('cocina'), 'der'), 650);
    expect(d.retorno!.largo).toBe(1200);
    expect(largoTramo(d, 'retorno')).toBe(1200 - 650);
    const corto = fijarRetorno(d, { largo: 100 });
    expect(corto.retorno!.largo).toBeGreaterThanOrEqual(LIMITES_RETORNO.largo[0]);
    expect(largoTramo(corto, 'retorno')).toBe(util(corto));
  });

  it('la L se ubica a un costado y la cubierta cubre la esquina', () => {
    const d = fijarForma(disenoLibre('cocina'), 'der');
    const [x0, x1] = extremosPrincipal(d);
    expect(x0).toBe(-d.ancho / 2);
    expect(x1).toBe(d.ancho / 2 + d.retorno!.profundidad);
    const caja = dimensionesTotales(d);
    expect(caja.fondo).toBe(1200);
    const dr = disenoRetorno(d)!;
    expect(dr.ancho).toBe(util(d));
    // La encimera y el lavaplatos quedan en el tramo principal.
    expect(dr.cocina.encimera).toBe('ninguna');
    expect(dr.cocina.lavaplatos).toBe('ninguno');
    expect(calcularLayout(dr).frentes.length).toBeGreaterThan(0);
  });

  it('el detalle y el precio incluyen la L', () => {
    const p = clasificarProducto(producto('Cocina full equipo: horno, encimera y lavaplatos · Clasic Pino Casina', '60 × 150 × 90 cm'));
    const base = disenoInicial(p);
    const d = fijarForma(base, 'der');
    const detalle = detalleCotizacion(d, p, 'cm', null);
    expect(detalle.find((l) => l.etiqueta === 'Forma')?.valor).toContain('en L a la derecha');
    expect(detalle.find((l) => l.etiqueta === 'Tramo en L')?.sub?.length).toBe(d.retorno!.cuerpos.length);
    expect(precioReferencial(d, p, base)!).toBeGreaterThan(precioReferencial(base, p, base)!);
  });
});

describe('muebles aéreos', () => {
  it('se activan sobre todo el tramo principal con una campana sobre la encimera', () => {
    const d = activarAereos(disenoLibre('cocina'), true);
    expect(d.aereos.activo).toBe(true);
    expect(largoTramo(d, 'aereos')).toBe(d.ancho);
    expect(d.aereos.cuerpos.some((c) => c.tipo === 'campana')).toBe(true);
    const la = calcularLayoutAereos(d)!;
    expect(la.y0).toBe(d.aereos.elevacion);
    expect(la.y1).toBe(d.aereos.elevacion + d.aereos.alto);
    expect(la.x0).toBe(-d.ancho / 2);
    expect(activarAereos(d, false).aereos.activo).toBe(false);
  });

  it('el nicho lleva una puerta abatible y la campana deja espacio libre abajo', () => {
    let d = activarAereos(disenoLibre('cocina'), true);
    d = agregarModulo(d, presetsModulo('cocina', 'aereos').find((p) => p.id === 'nicho')!, undefined, 'aereos');
    const la = calcularLayoutAereos(d)!;
    const iNicho = d.aereos.cuerpos.findIndex((c) => c.tipo === 'nicho');
    const puertasNicho = la.frentes.filter((f) => f.cuerpo === iNicho);
    expect(puertasNicho).toHaveLength(1);
    expect(puertasNicho[0].bisagra).toBe('arriba');
    expect(la.cuerpos[iNicho].nicho).not.toBeNull();
    const iCampana = d.aereos.cuerpos.findIndex((c) => c.tipo === 'campana');
    expect(la.cuerpos[iCampana].y0).toBeGreaterThan(la.y0);
  });

  it('en la L los aéreos no pasan el muro', () => {
    let d = activarAereos(fijarForma(disenoLibre('cocina'), 'der'), true);
    const [x0, x1] = extremosPrincipal(d);
    expect(largoTramo(d, 'aereos')).toBe(x1 - x0);
    const puerta = presetsModulo('cocina', 'aereos')[0];
    expect(anchoDisponible(d, 'frentes', puerta.ancho, undefined, 'aereos')).toBeNull();
    expect(agregarModulo(d, puerta, undefined, 'aereos')).toBe(d);
    // Si se pasa a L con aéreos más largos, se ajustan al muro.
    d = activarAereos(disenoLibre('cocina'), true);
    d = agregarModulo(d, puerta, undefined, 'aereos');
    d = fijarForma(d, 'izq');
    const [y0, y1] = extremosPrincipal(d);
    expect(largoTramo(d, 'aereos')).toBeLessThanOrEqual(y1 - y0);
    expect(advertencias(d).some((a) => a.texto.includes('pasan del muro'))).toBe(false);
  });

  it('avisa si los aéreos quedan muy cerca de la cubierta', () => {
    const d = activarAereos(disenoLibre('cocina'), true);
    const bajo = { ...d, aereos: { ...d.aereos, elevacion: 1200 } };
    expect(advertencias(bajo).some((a) => a.texto.includes('Entre la cubierta y los aéreos'))).toBe(true);
  });
});

describe('cocina compacta', () => {
  it('el compacto 5C de la tienda se arma con base, superior apoyado y nicho', () => {
    const p = clasificarProducto(producto('Mueble de cocina compacto 5C · Clasic Pino Nebraska', '40 × 180 × 190 cm'));
    expect(p.plantilla).toBe('compacto');
    expect(p.escenario).toBe('cocina');
    const d = disenoInicial(p);
    expect(d).toMatchObject({ ancho: 1800, alto: 1900, profundidad: 400 });
    expect(d.materiales).toMatchObject({ frente: 'pino-nebraska', cubierta: 'clasic' });
    expect(d.aereos).toMatchObject({ activo: true, montaje: 'apoyado' });
    expect(largoTramo(d, 'aereos')).toBe(d.ancho);
    expect(d.aereos.cuerpos.at(-1)!.tipo).toBe('nicho');
    // El mueble base termina bajo la cubierta, a la altura de la elevación.
    const l = calcularLayout(d);
    expect(l.alto).toBe(d.aereos.elevacion);
    const la = calcularLayoutAereos(d)!;
    expect(la.y1).toBe(d.alto);
    expect(la.yCubierta).toBe(d.aereos.elevacion);
  });

  it('el compacto 3C lleva cajón arriba y puerta abajo', () => {
    const d = disenoInicial(clasificarProducto(producto('Mueble de cocina compacto 3C · Calacatta Verde Salvia', '40 × 110 × 192 cm')));
    expect(d.materiales).toMatchObject({ frente: 'verde-salvia', cubierta: 'calacatta' });
    const l = calcularLayout(d);
    const cajon = l.frentes.find((f) => f.tipo === 'cajon' && f.cuerpo === 1)!;
    const puerta = l.frentes.find((f) => f.tipo === 'puerta' && f.cuerpo === 1)!;
    expect(cajon.rect.y0).toBeGreaterThan(puerta.rect.y1);
  });

  it('el mueble superior acompaña el ancho del base', () => {
    let d = disenoLibre('compacto');
    d = fijarAncho(d, 1500);
    expect(largoTramo(d, 'aereos')).toBe(1500);
    d = fijarAnchoCuerpo(d, 0, 700, 'aereos');
    expect(d.aereos.cuerpos[0].ancho).toBe(700);
    expect(largoTramo(d, 'aereos')).toBe(1500);
    d = agregarModulo(d, presetsModulo('compacto', 'aereos')[0], undefined, 'aereos');
    expect(largoTramo(d, 'aereos')).toBe(1500);
    d = quitarCuerpo(d, 0, 'aereos');
    expect(largoTramo(d, 'aereos')).toBe(1500);
  });

  it('al bajar el alto total se ajustan la base y el superior', () => {
    const d = fijarAlto(disenoLibre('compacto'), 1500);
    expect(d.aereos.elevacion + d.aereos.alto + 300).toBeLessThanOrEqual(d.alto);
  });

  it('el detalle describe el mueble superior', () => {
    const d = disenoLibre('compacto');
    const detalle = detalleCotizacion(d, null, 'cm', null);
    expect(detalle.find((l) => l.etiqueta === 'Mueble superior')?.sub?.some((s) => s.includes('nicho para microondas'))).toBe(true);
    expect(detalle.find((l) => l.etiqueta === 'Mueble base')).toBeTruthy();
  });
});

describe('diseños guardados antes de la L y los aéreos', () => {
  it('normalizar completa los campos que faltan', () => {
    const viejo = { ...disenoLibre('cocina') } as Partial<Diseno>;
    delete viejo.aereos;
    delete viejo.retorno;
    const d = normalizar(viejo as Diseno);
    expect(d.aereos.activo).toBe(false);
    expect(d.retorno).toBeNull();
    expect(calcularLayoutAereos(d)).toBeNull();
  });
});

describe('horno empotrado de medida fija', () => {
  const horno = (d: Diseno) => d.cuerpos.find((c) => c.tipo === 'horno')!;

  it('el horno mide 60 cm aunque cambie el ancho total; se ajustan los demás módulos', () => {
    const d = disenoLibre('cocina');
    expect(horno(d).ancho).toBe(ANCHO_HORNO);
    for (const ancho of [1100, 1800, 2400]) {
      const m = fijarAncho(d, ancho);
      expect(horno(m).ancho).toBe(ANCHO_HORNO);
      expect(m.ancho).toBe(ancho);
      expect(largoTramo(m, 'base')).toBe(ancho);
    }
  });

  it('no se puede cambiar el ancho del módulo del horno', () => {
    const d = disenoLibre('cocina');
    const i = d.cuerpos.findIndex((c) => c.tipo === 'horno');
    const m = fijarAnchoCuerpo(d, i, 750);
    expect(m.cuerpos[i].ancho).toBe(ANCHO_HORNO);
    expect(actualizarCuerpo(d, i, { ancho: 450 }).cuerpos[i].ancho).toBe(ANCHO_HORNO);
  });

  it('un módulo que pasa a ser horno toma los 60 cm, y uno nuevo solo se agrega si caben', () => {
    const d = disenoLibre('cocina');
    const i = d.cuerpos.findIndex((c) => c.tipo !== 'horno');
    const m = actualizarCuerpo(d, i, { tipo: 'horno' });
    expect(m.cuerpos[i].ancho).toBe(ANCHO_HORNO);
    expect(m.ancho).toBe(largoTramo(m, 'base'));
  });

  it('los diseños guardados con otro ancho de horno se corrigen al abrirlos', () => {
    const d = disenoLibre('cocina');
    const viejo = { ...d, cuerpos: d.cuerpos.map((c) => (c.tipo === 'horno' ? { ...c, ancho: 520 } : c)) };
    const n = normalizar(viejo);
    expect(horno(n).ancho).toBe(ANCHO_HORNO);
    expect(n.ancho).toBe(d.ancho);
    expect(largoTramo(n, 'base')).toBe(n.ancho);
  });

  it('una ficha de otro ancho mantiene el horno en 60 cm', () => {
    const d = disenoInicial(clasificarProducto(producto('Cocina full equipo: horno, encimera y lavaplatos · Clasic Pino Casina', '60 × 170 × 90 cm')));
    expect(horno(d).ancho).toBe(ANCHO_HORNO);
    expect(largoTramo(d, 'base')).toBe(1700);
  });

  it('el horno de juguete de la cocina infantil sí se adapta', () => {
    const d = disenoLibre('cocina-infantil');
    const m = fijarAncho(d, d.ancho + 300);
    expect(m.cuerpos.find((c) => c.tipo === 'horno')!.ancho).not.toBe(d.cuerpos.find((c) => c.tipo === 'horno')!.ancho);
  });
});
