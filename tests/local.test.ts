// Modo de demostración: mismas reglas que la base de datos.
import { beforeEach, describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import type { DatosCotizacion } from '../shared/tipos';
import { calcularTotales } from '../src/datos/backend';
import { backendLocal as b } from '../src/datos/local';

class Almacen {
  private m = new Map<string, string>();
  /** Tope de caracteres por clave (como el límite de espacio del navegador). */
  constructor(private limite = Infinity) {}
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (v.length > this.limite) throw new Error('QuotaExceededError');
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const datos = (cliente = 'Fernando Pérez', valor = 519990): DatosCotizacion => ({
  cliente: { nombre: cliente, telefono: '9 1234 5678', email: null, direccion: null },
  observaciones: null,
  productoId: 16,
  modelo: 'Cocina full equipo',
  config: disenoLibre('cocina'),
  detalle: [{ etiqueta: 'Medidas', valor: '150 × 90 × 60 cm' }],
  miniatura: null,
  valor,
  fecha: '2026-10-13',
});

beforeEach(() => {
  (globalThis as unknown as { localStorage: Almacen }).localStorage = new Almacen();
});

describe('modo local', () => {
  it('registra un vendedor, cierra e inicia sesión', async () => {
    await b.registrar({ nombre: 'Camila Rojas', email: 'Camila@DTO.cl', telefono: '', password: 'secreta123' });
    expect((await b.perfilActual())?.nombre).toBe('Camila Rojas');
    await b.salir();
    expect(await b.perfilActual()).toBeNull();
    await expect(b.ingresar('camila@dto.cl', 'otra')).rejects.toThrow(/incorrectos/);
    await b.ingresar('camila@dto.cl', 'secreta123');
    await expect(b.registrar({ nombre: 'Otra', email: 'camila@dto.cl', telefono: '', password: 'secreta123' })).rejects.toThrow(/Ya existe/);
  });

  it('cotiza, vende, bloquea cambios y separa vendedores', async () => {
    await b.registrar({ nombre: 'Camila Rojas', email: 'camila@dto.cl', telefono: '', password: 'secreta123' });
    const c = await b.crearCotizacion(datos());
    expect(c).toMatchObject({ numero: 'COT-0001', estado: 'cotizada', vendedor: { nombre: 'Camila Rojas' } });
    await expect(b.crearCotizacion(datos('', 1))).rejects.toThrow(/nombre del cliente/);
    const vendida = await b.registrarVenta(c.id, { fecha: '2026-10-15', valor: 500000, medioPago: 'Efectivo', nota: null });
    expect(vendida.venta?.valor).toBe(500000);
    await expect(b.actualizarCotizacion(c.id, datos())).rejects.toThrow(/ya está vendida/);
    expect(calcularTotales(await b.cotizaciones())).toEqual({ cotizaciones: 1, montoCotizado: 519990, ventas: 1, montoVendido: 500000 });
    const anulada = await b.cambiarEstado(c.id, 'anulada');
    expect(anulada.venta).toBeNull();
    await expect(b.registrarVenta(c.id, { fecha: '2026-10-16', valor: 1, medioPago: null, nota: null })).rejects.toThrow(/anulada/);

    await b.salir();
    await b.registrar({ nombre: 'Pedro Soto', email: 'pedro@dto.cl', telefono: '', password: 'secreta123' });
    expect(await b.cotizaciones()).toHaveLength(0);
    await expect(b.cotizacion(c.id)).rejects.toThrow(/no encontrada/);
  });
});

describe('marca e imagen en el modo local', () => {
  it('guarda la marca elegida; sin marca (cotizaciones viejas) es De Todito Outlet', async () => {
    await b.registrar({ nombre: 'Camila Rojas', email: 'camila@dto.cl', telefono: '', password: 'secreta123' });
    const molina = await b.crearCotizacion({ ...datos('Cliente Molina'), marca: 'molina' });
    expect(molina.marca).toBe('molina');
    const sinMarca = await b.crearCotizacion(datos('Cliente Sin Marca'));
    expect(sinMarca.marca).toBe('dto');
    await expect(b.crearCotizacion({ ...datos(), marca: 'otra' as never })).rejects.toThrow(/marca/);
    // Una fila guardada antes de que existiera la marca.
    const filas = JSON.parse(localStorage.getItem('dto-local-cotizaciones')!);
    delete filas[1].marca;
    localStorage.setItem('dto-local-cotizaciones', JSON.stringify(filas));
    expect((await b.cotizacion(sinMarca.id)).marca).toBe('dto');
    const actualizada = await b.actualizarCotizacion(molina.id, { ...datos('Cliente Molina'), marca: 'dto' });
    expect(actualizada.marca).toBe('dto');
    expect((await b.cotizaciones()).map((c) => c.marca)).toEqual(['dto', 'dto']);
  });

  it('la imagen grande viene al abrir la cotización, no en la lista', async () => {
    await b.registrar({ nombre: 'Camila Rojas', email: 'camila@dto.cl', telefono: '', password: 'secreta123' });
    const imagen = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
    const c = await b.crearCotizacion({ ...datos(), imagen, miniatura: 'data:image/jpeg;base64,BB' });
    expect(c.imagen).toBe(imagen);
    expect((await b.cotizacion(c.id)).imagen).toBe(imagen);
    const [enLista] = await b.cotizaciones();
    expect(enLista.imagen).toBeUndefined();
    expect(enLista.miniatura).toBe('data:image/jpeg;base64,BB');
    expect((await b.cambiarEstado(c.id, 'anulada')).imagen).toBeUndefined();
  });

  it('sin espacio en el navegador quita las imágenes grandes más antiguas y guarda la nueva', async () => {
    (globalThis as unknown as { localStorage: Almacen }).localStorage = new Almacen(60_000);
    await b.registrar({ nombre: 'Camila Rojas', email: 'camila@dto.cl', telefono: '', password: 'secreta123' });
    const imagen = (n: number) => `data:image/jpeg;base64,${String(n).repeat(20_000)}`;
    const ids: number[] = [];
    for (let i = 1; i <= 4; i++) ids.push((await b.crearCotizacion({ ...datos(`Cliente ${i}`), imagen: imagen(i) })).id);
    expect((await b.cotizacion(ids[3])).imagen).toBe(imagen(4));
    expect((await b.cotizacion(ids[0])).imagen).toBeNull();
    expect((await b.cotizaciones()).length).toBe(4);
  });
});
