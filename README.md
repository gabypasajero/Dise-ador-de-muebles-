# Diseñador 3D de muebles a medida · De Todito Outlet

Herramienta web **para los vendedores** de De Todito Outlet. El vendedor parte de un mueble del catálogo de [detoditooutlet.cl](https://detoditooutlet.cl), lo ajusta a medida junto al cliente con una vista 3D inmediata, **registra la cotización** y luego **la venta**. Las cuentas de vendedores y las cotizaciones se guardan en **Supabase**, en el mismo proyecto de la tienda.

## Qué hace

- **Acceso solo para vendedores** con Supabase Auth: «Registrarme como vendedor» (nombre, correo, teléfono opcional, contraseña y **código de vendedor**) e «Ingresar».
- **Catálogo de la tienda en vivo**: lee la tabla `productos` del proyecto de Supabase de la tienda (con una copia local de respaldo). Cada producto se asocia a un modelo 3D paramétrico y su foto queda como referencia en el visor.
- **Modelo 3D bien definido**: casco, frentes, cubierta postformada con copete, encimera, lavaplatos con grifería, horno, tiradores, repisas, barra para colgar y cajones. Puertas y cajones se abren con un clic.
- **Escenario según el mueble**: cocina, dormitorio o dormitorio infantil (o estudio neutro).
- **Medidas abajo**: alto, ancho y profundidad en **cm o mm**, y categorías de *puertas*, *cajones*, *módulos y espacios* (separación entre cuerpos, luz, zócalo, espacio libre, horno) y *equipamiento/interior*.
- **Colores a la derecha**: melamina de frentes y del cuerpo, cubierta postformada y tiradores (genéricos hasta tener el catálogo oficial; los de la tienda llevan el sello «DTO»). También se puede imprimir una imagen en los frentes.
- **Cotización**: datos del cliente, valor del mueble (sugerido desde el precio de la tienda) y fecha. Queda numerada (`COT-0001`) como «Cotización *cliente*», con la imagen 3D y los datos en lista, y cierra con **vendedor, fecha de cotización y valor del mueble**.
- **Al final de cada cotización**: **Descargar PDF**, **Imprimir**, **Enviar por correo** (Gmail, Outlook o la app de correo del equipo; el PDF se descarga para adjuntarlo) y **WhatsApp** al teléfono del cliente. En teléfonos y tablets aparece **Compartir PDF**, que envía el archivo adjunto directo por WhatsApp o correo.
- **Registro de cotizaciones y ventas** de cada vendedor: totales, filtros, búsqueda, reabrir el diseño, actualizar, registrar la venta (fecha, valor, medio de pago) o anular. Las cuentas de administración de la tienda (tabla `admins`) ven las cotizaciones de **todos** los vendedores.

## Puesta en marcha

### 1. Crear las tablas en Supabase (una sola vez)

1. Abre el archivo [`supabase/migrations/20261013120000_vendedores_cotizaciones.sql`](supabase/migrations/20261013120000_vendedores_cotizaciones.sql) y copia **todo su contenido** (en GitHub, botón «Copy raw file»). No pegues la ruta del archivo: el SQL Editor la intentaría ejecutar y mostraría `syntax error at or near "supabase"`.
2. En el panel de Supabase abre el proyecto **DTO detoditooutlet** → **SQL Editor** → **New query**.
3. Pega el contenido y presiona **Run**. Debe aparecer una fila con **Listo** y el **código de vendedor** (por ejemplo `DTO-4F9A2C`). Compártelo solo con tu equipo: lo piden al registrarse.

No hace falta crear otra organización ni otro proyecto. Se puede ejecutar más de una vez sin problema (el código se mantiene), y si por error se ejecuta en otro proyecto se detiene con un mensaje claro sin crear nada.

Crea, sin modificar lo que ya existe en la tienda:

| Objeto | Para qué |
| --- | --- |
| `vendedores` | Perfil de cada vendedor (se crea solo al registrarse con rol vendedor) |
| `cotizaciones` | Cotizaciones y ventas; cada vendedor ve y edita solo las suyas, los admins ven todas |
| `ajustes_privados` | Código de vendedor (no accesible desde la app) |
| Triggers en `auth.users` | Validan el código y crean el perfil **solo** cuando el registro es de vendedor; las cuentas de administración no se ven afectadas |

Las reglas se aplican en la base de datos (RLS y triggers): una cotización vendida no se edita, los datos de venta solo existen en cotizaciones vendidas y las cotizaciones no se borran (se anulan). Si la tienda borra un producto, sus cotizaciones se conservan (quedan sin enlace al producto).

### 2. Ajustes de autenticación en Supabase

En **Authentication → URL Configuration → Redirect URLs** agrega la dirección de la app publicada, `https://disenador-muebles-dto.vercel.app/**` (y `http://localhost:5173/**` para desarrollo), para que el enlace de confirmación del correo vuelva al diseñador. No cambies el **Site URL**: es el de la tienda, que comparte este proyecto.

Por defecto Supabase pide **confirmar el correo**: el vendedor recibe un enlace y luego ingresa. El correo integrado de Supabase permite pocos envíos por hora; si van a registrarse varios vendedores, configura un SMTP propio (**Authentication → SMTP Settings**). También puedes desactivar la confirmación (**Authentication → Sign In / Providers → Email → Confirm email**), ya que el código de vendedor impide registros ajenos; ten en cuenta que esa opción aplica a todas las cuentas del proyecto, incluidas las de la tienda.

### 3. Código de vendedor y vendedores

Para ver o cambiar el código, en el SQL Editor:

```sql
select valor from public.ajustes_privados where clave = 'codigo_vendedores';
update public.ajustes_privados set valor = 'NUEVO-CODIGO' where clave = 'codigo_vendedores';
```

Cambiarlo no afecta a quienes ya tienen cuenta. Con el valor vacío (`''`) cualquiera puede registrarse como vendedor.

Para **desactivar a un vendedor** (no puede ingresar, registrar ni ver cotizaciones; la administración sigue viendo las suyas):

```sql
update public.vendedores set activo = false where email = 'correo@dto.cl';
```

No borres vendedores desde **Authentication → Users**: si tienen cotizaciones, Supabase lo rechaza («Database error deleting user») porque el registro de cotizaciones se conserva.

### 4. Ejecutar

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev          # con Supabase: http://localhost:5173
npm run dev:local    # modo demostración sin Supabase (guarda todo en el navegador)
```

### 5. Publicar (Vercel u otro hosting estático)

```bash
npm run build        # genera dist/
```

Publicada en **https://disenador-muebles-dto.vercel.app** (proyecto `disenador-muebles-dto` en Vercel). Para otra publicación: importa el repositorio, framework **Vite**, comando `npm run build`, carpeta `dist`. Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` ya vienen por defecto con los valores públicos de la tienda (ver `.env.example`).

## Colores oficiales

Los colores están en `public/datos/materiales.json`. Para cargar el catálogo oficial reemplaza o agrega entradas en `melaminas`, `cubiertas` o `tiradores`; para usar una foto real del material copia la imagen a `public/texturas/` y agrega `"textura": "/texturas/archivo.jpg"`. Marca `"origen": "catalogo-dto"` para el sello «DTO».

## Copia de respaldo del catálogo

`public/datos/productos-respaldo.json` se usa si no hay conexión con Supabase. Para actualizarla:

```bash
npm run sync:productos
```

## Estructura

```
shared/        Tipos, clasificación del catálogo, motor de distribución (layout),
               reglas de medidas, precio referencial y detalle de la cotización
src/
  datos/       Supabase (auth, productos, cotizaciones) y modo local de demostración
  cotizacion/  PDF de la cotización y envío por correo / WhatsApp / compartir
  furniture/   Modelos 3D paramétricos y texturas procedurales
  scenes/      Escenarios (cocina, dormitorio, infantil, estudio)
  components/  Interfaz: acceso, visor, medidas, colores, cotizaciones
  store/       Estado de la app (zustand) con historial y borrador
supabase/      Migración SQL (tablas, RLS y triggers)
public/datos/  Colores y copia de respaldo del catálogo
tests/         Lógica de medidas, catálogo, PDF, modo local y la migración SQL
```

Todas las medidas internas están en milímetros; el visor convierte a metros.

## Pruebas

```bash
npm test
npm run typecheck
```

`tests/migracion.test.ts` ejecuta la migración de Supabase en un Postgres embebido (PGlite) que imita el proyecto de la tienda y verifica el registro de vendedores, el código, las políticas RLS, la vista de administración y las reglas de venta y anulación.
