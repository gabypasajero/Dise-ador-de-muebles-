// Actualiza la copia de respaldo del catálogo con los productos actuales de la tienda.
// Uso: npm run sync:productos
import fs from 'node:fs';
import { config } from '../config';
import { descargarProductos } from '../productos';

const { productos } = await descargarProductos();
fs.writeFileSync(config.rutaRespaldo, JSON.stringify(productos, null, 2) + '\n');
console.log(`Respaldo actualizado: ${productos.length} productos en ${config.rutaRespaldo}`);
