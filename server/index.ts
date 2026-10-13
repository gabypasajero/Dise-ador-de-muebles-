import { crearApp } from './app';
import { config } from './config';
import { abrirDb } from './db';
import { crearCatalogo } from './productos';

const db = abrirDb(config.rutaDb);
const catalogo = crearCatalogo();
const app = crearApp({ db, catalogo, servirCliente: config.produccion });

app.listen(config.puerto, () => {
  console.log(`API del diseñador escuchando en http://localhost:${config.puerto}`);
  // Precarga el catálogo para que la primera visita sea rápida.
  catalogo.obtener().then((c) => console.log(`[catálogo] ${c.productos.length} productos (${c.fuente})`));
});
