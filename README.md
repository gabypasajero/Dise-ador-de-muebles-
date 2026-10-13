# Diseñador 3D de muebles a medida · De Todito Outlet

Herramienta web fullstack **para los vendedores** de De Todito Outlet. El vendedor parte de un mueble del catálogo de [detoditooutlet.cl](https://detoditooutlet.cl), lo ajusta a medida junto al cliente con una vista 3D inmediata y **registra la cotización y luego la venta**. No está pensada para que el cliente la use directamente.

## Qué hace

- **Acceso solo para vendedores.** Sin sesión se muestra la pantalla de ingreso. Cada vendedor crea su cuenta en «Registrarme como vendedor» (nombre, correo, teléfono opcional y contraseña). Si se define `CODIGO_VENDEDORES`, el registro pide ese código, que entrega la administración de la tienda.
- **Catálogo de la tienda en vivo.** El servidor lee la configuración pública de detoditooutlet.cl y descarga los productos activos (muebles de cocina, clósets, cómodas, tocadores, escritorios y cocinas infantiles). Cada producto se asocia a un modelo 3D paramétrico y su foto queda como referencia en el visor.
- **Modelo 3D bien definido.** Casco, frentes, cubierta postformada con borde redondeado y copete, encimera a gas, lavaplatos con grifería, horno empotrado, tiradores, repisas, barra para colgar y cajas de cajón. Puertas y cajones se abren con un clic (o todos con «Abrir puertas»).
- **Escenario según el mueble.** Cocina (porcelanato, azulejo, campana, refrigerador), dormitorio (cama, velador, ventana) o dormitorio infantil; se puede cambiar a mano o usar un estudio neutro.
- **Medidas abajo.** Tres líneas para **alto, ancho y profundidad** con cambio de unidad **cm / mm**, y categorías según el tipo de mueble:
  - *Puertas*: cantidad por cuerpo, bisagra, tipo de tirador y la medida de cada puerta (también se muestran sobre el 3D).
  - *Cajones*: cantidad, columnas, alto a medida y medida de cada frente.
  - *Módulos y espacios*: ancho de cada cuerpo, separación entre cuerpos, luz entre frentes, zócalo, espesor de melamina, espacio libre (lavadora, refrigerador) y horno.
  - *Equipamiento / Interior / Espejo y luz*: encimera y lavaplatos (sobre qué cuerpo), grifería, cubierta; repisas y barra en clósets; tipo de espejo y luz en tocadores.
- **Colores a la derecha.** Melamina de frentes, melamina del cuerpo, cubierta postformada y tiradores. Hay colores genéricos mientras llega el catálogo oficial; los de la tienda (Gris Blanqueado, Pino Casina, Pino Nebraska, Clasic, Florentino, Granito) vienen marcados «DTO». También se puede subir una imagen para imprimir en los frentes.
- **Registro de cotización.** Con «Registrar cotización» el vendedor ingresa los datos del cliente (nombre, teléfono, correo, dirección o comuna, observaciones), el valor del mueble (sugerido desde el precio de la tienda y editable) y la fecha. La cotización queda numerada (`COT-0001`) con el título «Cotización *cliente*», la imagen 3D y los datos en lista, y cierra con **vendedor, fecha de cotización y valor del mueble**. Se puede imprimir o guardar en PDF, copiar o enviar al cliente por WhatsApp.
- **Registro de cotizaciones y ventas.** Cada vendedor ve su historial con totales (monto cotizado, ventas, monto vendido y porcentaje de cierre), filtra por estado, busca por cliente, reabre el diseño en el 3D, actualiza una cotización vigente, registra la venta (fecha, valor final, medio de pago y nota) o la anula.
- Recomendaciones de fabricación (puertas muy anchas, cajones muy bajos, horno en cuerpos angostos…), deshacer/rehacer y borrador automático.

## Cómo ejecutarlo

Requiere Node.js 22.13 o superior (usa el SQLite incluido en Node).

```bash
npm install
npm run dev
```

Abre http://localhost:5173. La API corre en http://localhost:3001 y Vite la expone en `/api`.

### Producción

```bash
npm run build
JWT_SECRET="una-clave-larga-y-secreta" npm start
```

El servidor sirve la app compilada y la API en el mismo puerto (`PORT`, por defecto 3001).

### Variables de entorno

| Variable | Uso | Por defecto |
| --- | --- | --- |
| `PORT` | Puerto del servidor | `3001` |
| `JWT_SECRET` | Firma de las sesiones (obligatoria en producción) | solo para desarrollo |
| `DB_PATH` | Archivo SQLite | `server/data/disenador.db` |
| `TIENDA_URL` | Sitio del que se leen los productos | `https://detoditooutlet.cl` |
| `TIENDA_SUPABASE_URL`, `TIENDA_SUPABASE_KEY` | Respaldo si no se puede leer `config.js` de la tienda | valores públicos actuales |
| `CODIGO_VENDEDORES` | Código que se pide para registrar vendedores (recomendado en producción) | sin código: registro abierto |
| `CACHE_PRODUCTOS_MS` | Duración de la caché del catálogo | 15 minutos |

## Productos de la tienda

`server/productos.ts` descarga `https://detoditooutlet.cl/config.js`, obtiene la URL y la clave publicable (solo lectura de productos activos) y consulta la tabla `productos`. El resultado se guarda 15 minutos en caché. Si la tienda no responde se usa la copia `server/data/productos-respaldo.json`, que se actualiza con:

```bash
npm run sync:productos
```

`shared/catalogo.ts` clasifica cada producto: plantilla 3D, escenario, modelo y variante (por ejemplo «Clasic Pino Casina» → cubierta Clasic, melamina Pino Casina), y lee las medidas de la ficha (`profundidad × ancho × alto`). Si la ficha no trae medidas se usan medidas aproximadas, que se indican como «aprox.».

## Colores oficiales

Los colores están en `server/data/materiales.json`. Para cargar el catálogo oficial:

1. Reemplaza o agrega entradas en `melaminas`, `cubiertas` o `tiradores`.
2. Para usar una foto real del material, copia la imagen a `public/texturas/` y agrega `"textura": "/texturas/archivo.jpg"` a la entrada. Sin textura, el color se dibuja con una veta procedural según `tipo` (`liso`, `madera`, `marmol`, `granito`, `concreto`).
3. Marca `"origen": "catalogo-dto"` para que aparezca con el sello «DTO».

No hace falta recompilar: el servidor entrega el archivo en `/api/materiales`.

## Estructura

```
shared/      Tipos, clasificación del catálogo, motor de distribución (layout),
             reglas de medidas, precio referencial y detalle de la cotización
server/      API Express + SQLite: catálogo, materiales, cuentas de vendedores
             (JWT + bcrypt), cotizaciones y ventas
src/
  furniture/ Modelos 3D paramétricos (cocina, cuerpos, tocador), texturas procedurales
  scenes/    Escenarios (cocina, dormitorio, infantil, estudio)
  components/Interfaz: visor, panel de medidas, colores, modales
  store/     Estado de la app (zustand) con historial y borrador
tests/       Pruebas de la lógica y de la API (vitest + supertest)
```

Todas las medidas internas están en milímetros; el visor convierte a metros.

## API

| Método y ruta | Uso |
| --- | --- |
| `GET /api/productos`, `GET /api/materiales` | Catálogo de la tienda y colores |
| `GET /api/auth/registro` | Indica si el registro pide código de vendedor |
| `POST /api/auth/registro`, `POST /api/auth/login`, `GET /api/auth/yo` | Cuentas de vendedores |
| `GET /api/cotizaciones` | Registro del vendedor con totales |
| `GET /api/cotizaciones/:id` | Cotización con el diseño completo |
| `POST /api/cotizaciones`, `PUT /api/cotizaciones/:id` | Registrar o actualizar una cotización vigente |
| `POST /api/cotizaciones/:id/venta` | Registrar la venta |
| `POST /api/cotizaciones/:id/estado` | Anular o reactivar (`cotizada` / `anulada`) |

Cada vendedor solo ve y modifica sus propias cotizaciones.

## Pruebas

```bash
npm test          # lógica de medidas, catálogo y API
npm run typecheck
```

## Notas de despliegue

La base de datos es un archivo SQLite, ideal para un servidor con disco persistente (VPS, Railway, Render, Fly.io). En plataformas sin disco persistente (por ejemplo funciones serverless de Vercel) conviene mover vendedores y cotizaciones a una base gestionada como Postgres o Supabase; el acceso a datos está concentrado en `server/app.ts` y `server/db.ts`.
