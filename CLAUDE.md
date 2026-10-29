# Reglas de trabajo (las pidió la dueña; se cumplen siempre)

## Idioma: todo en español
- Todo en español, sin excepción: los mensajes, los avisos de avance mientras se trabaja, las
  descripciones de los comandos, los mensajes de commit, los comentarios del código y los textos de
  la app. Nada en inglés.
- Después de cada trabajo, un resumen completo en español de todo lo que se hizo, sin saltarse nada.

## Publicar
- Se trabaja en la rama `claude/custom-furniture-3d-designer-79xkhv` y se sube también a `main`
  (`git push origin HEAD:main`): la versión principal se publica desde `main`.
- Cuando un cambio está listo y probado, se sube directo a la versión principal sin preguntar.
- Publicar siempre a mano en Vercel (`create_deployment`, producción, ref `main`, con el sha) y
  confirmar que la página en línea ya tiene el cambio: la publicación automática a veces no parte.
- Antes de subir: `npx tsc --noEmit -p .`, `npx vitest run` y `npm run build` sin errores.

## Pruebas en la app
- Cuenta de vendedor de prueba: prueba.claude.1792407695603@detoditooutlet.cl (se mantiene).
- Toda cotización de prueba que se cree se borra al terminar la prueba.

## Reglas del diseñador (no cambiar sin que la dueña lo pida)
- Las medidas siempre se pueden editar; no hay topes para quien edita a mano.
- Un módulo al que se le da el ancho a mano queda fijado: al editar otro módulo, la diferencia la
  toman primero los módulos con cajones, luego los demás no fijados y, solo si falta, los fijados.
- Recomendaciones: puertas de 35 cm ±10 (25 a 45); cajoneras de 40 cm estándar, de 30 a 90 cm.
- Cierre suave por mueble (base y aéreo por separado): hasta 2 m $50.000, de 2 a 5 m $80.000,
  sobre 5 m $100.000.
- Las claves de API nunca se pegan en el chat (la de Gemini está en Vercel como GEMINI_APY_KEY).
