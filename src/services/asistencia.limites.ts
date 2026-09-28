// Cuantos intentos por minuto acepta el marcador de cada local.
//
// EL PROBLEMA QUE RESUELVE
// En un local todas las marcas salen por la MISMA IP -- la del local -- asi que
// un numero fijo no puede servir para todos: el que le sobra a un restaurante
// de seis personas le queda corto a uno de cuarenta saliendo juntos del turno.
// Y cuando queda corto, el sintoma es el peor: la gente escanea y el marcador
// les dice que esperen, justo cuando se estan por ir.
//
// COMO SE RESUELVE
// Se pregunta UNA cosa que el dueno sabe de memoria -- cuanta gente marca -- y
// los cinco limites salen de ahi. Si no configuro nada, se cuenta el personal
// cargado en la sede.
//
// POR QUE HAY CACHE
// El limite se consulta en CADA pedido publico, antes de tocar nada. Ir a la
// base cada vez convertiria el escudo en la carga que se queria evitar. Cinco
// minutos de cache: cambiar el numero tarda un rato en verse, y eso esta bien
// para un valor que se toca una vez al ano.

import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

/** Cuanta gente se asume cuando no hay ni configuracion ni personal cargado. */
const PERSONAS_POR_DEFECTO = 15;

/** Techo: mas que esto ya no protege de nada. */
const PERSONAS_MAX = 300;

const CACHE_MS = 5 * 60_000;

export interface Limites {
    codigo: number;
    marcar: number;
    marcar_info: number;
    enrolar_info: number;
    enrolar_confirmar: number;
}

/**
 * Los cinco limites a partir de cuanta gente marca.
 *
 * Los factores salen de como se usa cada endpoint, no de una formula:
 *   - `codigo` lo pide la PANTALLA cada 15 s, no las personas: 4 por minuto por
 *     pantalla. Se deja lugar para varias pantallas y para reintentos.
 *   - `marcar` es una vez por persona al entrar y otra al salir, pero todo el
 *     turno puede salir en el mismo minuto. Se da el doble de la gente.
 *   - enrolar pasa una vez por persona en la vida del celular: alcanza poco.
 */
export function limitesPara(personas: number): Limites {
    const n = Math.max(1, Math.min(personas || PERSONAS_POR_DEFECTO, PERSONAS_MAX));
    return {
        codigo: Math.max(60, n * 8),
        marcar: Math.max(20, n * 2),
        marcar_info: Math.max(30, n * 3),
        enrolar_info: Math.max(20, n),
        enrolar_confirmar: Math.max(15, n)
    };
}

export const LIMITES_POR_DEFECTO = limitesPara(PERSONAS_POR_DEFECTO);

interface Entrada { limites: Limites; hasta: number }

/**
 * Un solo cache para las tres formas de llegar al local, con la clave
 * prefijada: 'k:' por id de kiosko, 't:' por token y 'i:' por invitacion.
 *
 * TIENE TOPE A PROPOSITO. Las claves 't:' e 'i:' vienen de lo que MANDA EL
 * CLIENTE, y se guardan aunque no existan -- ese es justamente el caso que hay
 * que frenar barato. Sin tope, alguien probando valores al azar llenaria la
 * memoria del servidor a fuerza de pedidos fallidos.
 */
const TOPE_CACHE = 2000;
const cache = new Map<string, Entrada>();

function recordar(clave: string, limites: Limites) {
    // Al llenarse se vacia entero en vez de expulsar el mas viejo: un LRU aqui
    // seria codigo y estructura para ahorrar unas consultas cada tanto.
    if (cache.size >= TOPE_CACHE) { cache.clear(); }
    cache.set(clave, { limites, hasta: Date.now() + CACHE_MS });
}

/**
 * Cuanta gente marca en una sede, segun lo configurado o el personal cargado.
 * `idsede` es el de Recursos Humanos, no el del POS.
 */
async function limitesDeSede(idorg: number, idsede: number): Promise<Limites> {
    const sede: any = await prisma.sede.findFirst({ where: { idorg, idsede } as any });

    const configurado = Number(sede?.marcador_personas) || 0;
    const personas = configurado || await prisma.colaborador.count({
        where: { idorg, idsede, estado: 0 } as any
    });

    return limitesPara(personas);
}

/**
 * El molde de las tres busquedas: cache, consulta, y por defecto si algo falla.
 *
 * Si el kiosko no existe, la invitacion no sirve o la base no responde,
 * devuelve los valores por defecto. Un error al LEER la configuracion no puede
 * dejar sin marcar a todo un local: el escudo se cae del lado seguro.
 */
async function resolver(clave: string, buscar: () => Promise<Limites | null>): Promise<Limites> {
    const en = cache.get(clave);
    if (en && en.hasta > Date.now()) { return en.limites; }

    let limites = LIMITES_POR_DEFECTO;
    try {
        limites = (await buscar()) || LIMITES_POR_DEFECTO;
    } catch (e) {
        console.error('[limites] no se pudo leer la configuracion de', clave, e);
    }

    recordar(clave, limites);
    return limites;
}

/** Los limites del local al que pertenece un marcador, por su id. */
export async function limitesDeKiosko(idkiosko: number): Promise<Limites> {
    if (!idkiosko) { return LIMITES_POR_DEFECTO; }

    return resolver('k:' + idkiosko, async () => {
        const k: any = await prisma.asistencia_kiosko.findFirst({
            where: { idkiosko, revocado_at: null } as any
        });
        if (!k) { return null; }

        const sede: any = await prisma.sede.findFirst({
            where: { idorg: k.idorg, idsede_restobar: k.idsede_restobar } as any
        });
        return sede ? limitesDeSede(k.idorg, sede.idsede) : null;
    });
}

/**
 * Lo mismo, pero cuando lo unico que llega es el token de la pantalla.
 *
 * Es el caso de /codigo, que se pide cada 15 segundos y no manda idkiosko. Se
 * busca por `token_hash`, que tiene indice unico: un token inventado cuesta una
 * busqueda por indice, no un recorrido de la tabla.
 */
export async function limitesDeToken(token: string): Promise<Limites> {
    if (!token) { return LIMITES_POR_DEFECTO; }

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return resolver('t:' + hash, async () => {
        const k: any = await prisma.asistencia_kiosko.findFirst({
            where: { token_hash: hash, revocado_at: null } as any
        });
        if (!k) { return null; }

        const sede: any = await prisma.sede.findFirst({
            where: { idorg: k.idorg, idsede_restobar: k.idsede_restobar } as any
        });
        return sede ? limitesDeSede(k.idorg, sede.idsede) : null;
    });
}

/**
 * Lo mismo, cuando lo unico que llega es el codigo de invitacion a enrolarse.
 *
 * Busca por `colaborador.qr_invitacion`, indexado en la migracion 061. Sin ese
 * indice cada intento fallido recorreria la tabla entera de colaboradores, que
 * es precisamente el gasto que el limite existe para evitar.
 */
export async function limitesDeInvitacion(uuid: string): Promise<Limites> {
    if (!uuid) { return LIMITES_POR_DEFECTO; }

    return resolver('i:' + uuid, async () => {
        const c: any = await prisma.colaborador.findFirst({
            where: { qr_invitacion: uuid } as any
        });
        return c ? limitesDeSede(c.idorg, c.idsede) : null;
    });
}

/** Para que un cambio de configuracion se vea sin esperar los cinco minutos. */
export function olvidarCache() { cache.clear(); }
