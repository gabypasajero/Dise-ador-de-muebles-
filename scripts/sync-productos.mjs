// Actualiza la copia de respaldo del catálogo (public/datos/productos-respaldo.json)
// con los productos activos de la tienda. Uso: npm run sync:productos
// Se corre en cada build (npm run build) con --sin-fallar: si la tienda no responde, la
// publicación sigue con la copia anterior en vez de detenerse.
import fs from 'node:fs';

const sinFallar = process.argv.includes('--sin-fallar');

const url = process.env.VITE_SUPABASE_URL || 'https://bmxmqhbkgvgyqpwsuazm.supabase.co';
const clave = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_C4bwkSAfBBHNg8z523_qpw_P-PDzciI';
const campos = 'id,nombre,categoria,descripcion,medidas,precio,precio_oferta,imagen_url,personalizable,destacado,orden';

let r;
try {
  r = await fetch(`${url}/rest/v1/productos?select=${campos}&activo=eq.true&order=destacado.desc,orden.asc,nombre.asc`, {
  headers: { apikey: clave, Authorization: `Bearer ${clave}` },
});
  if (!r.ok) throw new Error(`La tienda respondió ${r.status}`);
} catch (e) {
  if (!sinFallar) throw e;
  console.warn(`Catálogo: se mantiene la copia anterior (${e.message})`);
  process.exit(0);
}
const productos = await r.json();
fs.writeFileSync('public/datos/productos-respaldo.json', JSON.stringify(productos, null, 2) + '\n');
console.log(`Respaldo actualizado: ${productos.length} productos`);
