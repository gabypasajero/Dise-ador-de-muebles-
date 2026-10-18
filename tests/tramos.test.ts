// Cocina en L, muebles aéreos y cocina compacta.
import { describe, expect, it } from 'vitest';
import { clasificarProducto, disenoInicial, disenoLibre } from '../shared/catalogo';
import { calcularLayout, calcularLayoutAereos, centroCuerpo, dimensionesTotales, disenoRetorno, extremosPrincipal } from '../shared/layout';
import {
  ANCHO_HORNO,
  LIMITES,
  LIMITES_RETORNO,
  actualizarCuerpo,
  activarAereos,
  advertencias,
  agregarModulo,
  anchoDisponible,
  cabeHorno,
  cuerposDe,
  fijarAereos,
  fijarAlto,
  fijarAncho,
  fijarAnchoAereos,
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
import { describirCuerpos, detalleCotizacion } from '../shared/resumen';
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

describe('correcciones de la revisión de tramos', () => {
  const full = () => disenoInicial(clasificarProducto(producto('Cocina full equipo: horno, encimera y lavaplatos · Clasic Pino Casina', '60 × 150 × 90 cm')));
  const c3 = () => disenoInicial(clasificarProducto(producto('Mueble de cocina compacto 3C · Calacatta Verde Salvia', '40 × 110 × 192 cm')));
  const c5 = () => disenoInicial(clasificarProducto(producto('Mueble de cocina compacto 5C · Clasic Pino Nebraska', '40 × 180 × 190 cm')));
  const anchos = (d: Diseno, tramo: 'base' | 'retorno' | 'aereos') => cuerposDe(d, tramo).map((c) => c.ancho);
  const recargar = (d: Diseno) => normalizar(JSON.parse(JSON.stringify(d)));
  const textos = (d: Diseno) => advertencias(d).map((a) => a.texto);
  const preset = (p: Diseno['plantilla'], tramo: 'base' | 'retorno' | 'aereos', id: string) => presetsModulo(p, tramo).find((x) => x.id === id)!;
  const conPuertas = (d: Diseno, k: number) => {
    for (let i = 0; i < k; i++) d = agregarModulo(d, preset('cocina', 'base', 'puerta'));
    return d;
  };
  const campanaSobreEncimera = (d: Diseno) => {
    const x = centroCuerpo(calcularLayout(d), d.cocina.encimeraCuerpo);
    return calcularLayoutAereos(d)!.cuerpos.some((c) => c.cuerpo.tipo === 'campana' && c.x0 <= x && x <= c.x1);
  };

  it('1: el cajón arriba con alto a medida deja siempre una puerta de al menos 20 cm', () => {
    const d = fijarAlto(actualizarCuerpo(full(), 2, { cajones: 1, cajonesArriba: true, altoCajon: 600 }), 700);
    const frentes = calcularLayout(d).frentes.filter((f) => f.cuerpo === 2);
    const cajon = frentes.find((f) => f.tipo === 'cajon')!;
    const puerta = frentes.find((f) => f.tipo === 'puerta')!;
    expect(puerta.rect.y1 - puerta.rect.y0).toBeGreaterThanOrEqual(200);
    expect(cajon.rect.y0).toBeGreaterThan(puerta.rect.y1);
    expect(cajon.rect.y0).toBeGreaterThan(d.zocalo);
    expect(describirCuerpos(d, 'cm')[2]).not.toContain('-');
  });

  it('2 y 27: en el compacto un superior único mide siempre lo mismo que el base', () => {
    const d = quitarCuerpo(c3(), 1, 'aereos');
    expect(anchos(d, 'aereos')).toEqual([d.ancho]);
    expect(anchos(fijarAnchoCuerpo(d, 0, 600, 'aereos'), 'aereos')).toEqual([d.ancho]);
    const m = actualizarCuerpo(d, 0, { ancho: 500 }, 'aereos');
    expect(anchos(m, 'aereos')).toEqual([d.ancho]);
    expect(anchos(recargar(m), 'aereos')).toEqual(anchos(m, 'aereos'));
  });

  it('3 y 29: en el compacto el base no queda más angosto que lo mínimo del superior', () => {
    let d = c3();
    for (let i = 0; i < 3; i++) d = agregarModulo(d, preset('compacto', 'aereos', 'aereo-puerta'), undefined, 'aereos');
    for (const m of [fijarAncho(d, 600), quitarCuerpo(d, 1)]) {
      expect(Math.min(...anchos(m, 'aereos'))).toBeGreaterThanOrEqual(150);
      expect(largoTramo(m, 'aereos')).toBe(m.ancho);
      expect(largoTramo(m, 'base')).toBe(m.ancho);
    }
    // Un módulo base único no deja el compacto bajo su ancho mínimo.
    const q = fijarAnchoCuerpo(quitarCuerpo(quitarCuerpo(c5(), 0), 0), 0, 150);
    expect(q.ancho).toBeGreaterThanOrEqual(LIMITES.compacto.ancho[0]);
    expect(Math.min(...anchos(q, 'aereos'))).toBeGreaterThanOrEqual(150);
    expect(recargar(q).ancho).toBe(q.ancho);
  });

  it('4: un módulo no pasa a horno si los 60 cm no caben en el ancho máximo', () => {
    const d = conPuertas(full(), 5);
    expect(d.ancho).toBe(LIMITES.cocina.ancho[1]);
    expect(actualizarCuerpo(d, 3, { tipo: 'horno' })).toBe(d);
    expect(cabeHorno(d, 3)).toBe(false);
    // El módulo de 60 cm sí puede pasar a horno, y en una cocina con espacio también los demás.
    expect(cabeHorno(d, 0)).toBe(true);
    expect(cabeHorno(full(), 1)).toBe(true);
    expect(actualizarCuerpo(full(), 1, { tipo: 'horno' }).ancho).toBe(1650);
  });

  it('5: al repartir, ningún módulo queda bajo el mínimo si el largo alcanza', () => {
    const d = fijarAncho(conPuertas(full(), 5), 1650);
    expect(anchos(d, 'base')).toEqual([600, 150, 150, 150, 150, 150, 150, 150]);
    let a = agregarModulo(activarAereos(full(), true), preset('cocina', 'aereos', 'aereo-puerta'), undefined, 'aereos');
    a = fijarAnchoAereos(a, 450);
    expect(anchos(a, 'aereos')).toEqual([150, 150, 150]);
    let e = c5();
    for (let i = 0; i < 2; i++) e = agregarModulo(e, preset('compacto', 'aereos', 'aereo-puerta'), undefined, 'aereos');
    e = actualizarCuerpo(e, 0, { ancho: 1500 }, 'aereos');
    expect(anchos(e, 'aereos')).toEqual([1200, 150, 150, 150, 150]);
  });

  it('6 y 28: el módulo de la L no deja la L bajo su largo mínimo', () => {
    const d = fijarForma(full(), 'der');
    for (const m of [actualizarCuerpo(d, 0, { ancho: 150 }, 'retorno'), fijarAnchoCuerpo(d, 0, 200, 'retorno')]) {
      expect(m.retorno!.largo).toBe(LIMITES_RETORNO.largo[0]);
      expect(largoTramo(m, 'retorno')).toBe(util(m));
      expect(recargar(m).retorno).toEqual(m.retorno);
    }
  });

  it('7: en la L los aéreos se acortan si el tramo principal o la esquina se achican', () => {
    const d = activarAereos(fijarForma(full(), 'der'), true);
    const m = quitarCuerpo(fijarRetorno(fijarAncho(d, 1100), { profundidad: 450 }), 1);
    for (const x of [fijarAncho(d, 1100), fijarRetorno(d, { profundidad: 450 }), m]) {
      const [x0, x1] = extremosPrincipal(x);
      const la = calcularLayoutAereos(x)!;
      expect(la.x0).toBeGreaterThanOrEqual(x0);
      expect(la.x1).toBeLessThanOrEqual(x1);
      expect(textos(x).some((t) => t.includes('pasan del muro'))).toBe(false);
    }
  });

  it('8: avisa si el nicho del microondas queda muy bajo', () => {
    const d = agregarModulo(activarAereos(full(), true), preset('cocina', 'aereos', 'nicho'), undefined, 'aereos');
    expect(textos(d).some((t) => t.includes('nicho'))).toBe(false);
    expect(textos(fijarAereos(d, { alto: 400 })).some((t) => t.includes('El nicho del aéreo 3'))).toBe(true);
    expect(textos(c5()).some((t) => t.includes('nicho'))).toBe(false);
    expect(textos(fijarAereos(c5(), { alto: 350 })).some((t) => t.includes('El nicho del mueble superior'))).toBe(true);
  });

  it('9: avisa si la campana no queda sobre la encimera', () => {
    const d = activarAereos(full(), true);
    expect(textos(d).some((t) => t.includes('campana'))).toBe(false);
    const otra = { ...d, cocina: { ...d.cocina, encimeraCuerpo: 1, lavaplatosCuerpo: 2 } };
    expect(textos(otra).some((t) => t.includes('La campana de los aéreos no queda sobre la encimera'))).toBe(true);
  });

  it('11: en el compacto la encimera de 3 platos sobre un módulo angosto también avisa', () => {
    let d = c5();
    d = actualizarCuerpo({ ...d, cocina: { ...d.cocina, encimera: '3', encimeraCuerpo: 1 } }, 1, { ancho: 300 });
    expect(textos(d).some((t) => t.includes('La encimera sobresale del módulo 2'))).toBe(true);
  });

  it('18: al cambiar la forma la campana sigue sobre la encimera', () => {
    const d = activarAereos(full(), true);
    expect(campanaSobreEncimera(d)).toBe(true);
    const izq = fijarForma(d, 'izq');
    for (const x of [izq, fijarForma(d, 'der'), fijarForma(izq, 'der'), fijarForma(izq, null)]) {
      expect(campanaSobreEncimera(x)).toBe(true);
      expect(textos(x).some((t) => t.includes('pasan del muro'))).toBe(false);
    }
    // Aéreos creados en la L: el módulo de la esquina pasa a la otra punta.
    const l = activarAereos(fijarForma(full(), 'izq'), true);
    for (const x of [fijarForma(l, 'der'), fijarForma(l, null), fijarRetorno(l, { profundidad: 450 })]) {
      expect(campanaSobreEncimera(x)).toBe(true);
      expect(textos(x).some((t) => t.includes('pasan del muro'))).toBe(false);
    }
  });

  it('32: avisa si el compacto lleva encimera a gas bajo el mueble superior', () => {
    const d = c5();
    expect(textos(d).some((t) => t.includes('bajo el mueble superior'))).toBe(false);
    expect(textos({ ...d, cocina: { ...d.cocina, encimera: '4' } }).some((t) => t.includes('La encimera a gas queda 46 cm bajo el mueble superior'))).toBe(true);
  });
});
