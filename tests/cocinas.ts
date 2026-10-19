// Diseños de cocina para las pruebas: en las cocinas solo las cajoneras (y los abatibles en los
// aéreos) ceden o toman espacio al agregar o quitar módulos, así que para probar un agregar o
// quitar exitoso hace falta un diseño con cajoneras que tengan de dónde ceder.
import { cuerpo } from '../shared/catalogo';
import { normalizar } from '../shared/reglas';
import type { Diseno } from '../shared/tipos';

/** El mismo diseño con cajoneras (de los anchos dados) agregadas al final del tramo principal, agrandando el mueble. */
export function conCajoneras(d: Diseno, cajoneras: number[] = [900, 900, 900]): Diseno {
  const cuerpos = [...d.cuerpos, ...cajoneras.map((ancho) => cuerpo({ ancho, cajones: 3 }))];
  const ancho = cuerpos.reduce((a, c) => a + c.ancho, 0) + d.separacionCuerpos * (cuerpos.length - 1);
  return normalizar({ ...d, ancho, cuerpos });
}
