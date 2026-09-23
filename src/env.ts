// Carga del .env, anclada al CODIGO y no al directorio de trabajo.
//
// POR QUE EXISTE ESTE ARCHIVO
// `import 'dotenv/config'` busca el .env en process.cwd(). En produccion pm2
// arranca con cwd = <proyecto>/src, asi que dotenv buscaba <proyecto>/src/.env
// -- que no existe -- y cargaba CERO variables. El log lo decia con todas las
// letras ("injected env (0) from .env") y nadie lo miraba, porque nada fallaba:
//
//   - Prisma lee su propio .env aparte, asi que la base seguia conectando.
//   - SECRET_KEY estaba escrito en el codigo.
//   - POS_SHARED_SECRET no se usaba todavia en produccion.
//
// El dia que esas dos cosas pasaron a leerse del entorno, la API dejo de
// arrancar. El sintoma aparecio lejos de la causa, que es la marca de este tipo
// de bug: llevaba meses roto sin consecuencias.
//
// __dirname apunta a donde esta ESTE archivo, corra desde donde corra el
// proceso. Es lo unico que no depende de como se lo invoque.
//
// SE IMPORTA PRIMERO, SIEMPRE. Los `import` se resuelven en orden y el efecto
// de este modulo tiene que correr antes de que cualquier otro lea process.env.
// Por eso vive en su propio archivo y no dentro de app.ts: ahi quedaria
// despues de los imports, que ya se habrian ejecutado.

import * as dotenv from 'dotenv';
import * as path from 'path';

// Compilado, este archivo queda en <proyecto>/src/env.js -> el .env esta arriba
const RUTA = path.resolve(__dirname, '../.env');

const r = dotenv.config({ path: RUTA });

if (r.error) {
    console.error(`[env] No se pudo leer ${RUTA}:`, r.error.message);
} else {
    console.log(`[env] ${Object.keys(r.parsed || {}).length} variable(s) desde ${RUTA}`);
}
