// Bitacora de cambios: quien toco que, cuando y con la autorizacion de quien.
//
// Se registra todo lo que puede cambiar cuanto cobra alguien: horarios, dias de
// cierre, excepciones, feriados. Ante un reclamo ("mi horario no era ese") hay
// que poder responder con un hecho, no con la memoria de nadie.
//
// El detalle se arma AQUI, en el momento del cambio, y se guarda como frase.
// No se reconstruye al leer: si manana cambia el formato de los horarios, lo
// que se escribio ayer tiene que seguir leyendose igual.

import { PrismaClient } from "@prisma/client";
import { ahoraLima, fechaSql, HorarioSemanal } from "./asistencia.calendario";

const prisma = new PrismaClient();

export type Entidad = 'HORARIO' | 'EXCEPCION' | 'FERIADO' | 'DIAS_CIERRE' | 'MARCA' | 'GPS' | 'POLITICA' | 'PLANILLA';
export type Accion = 'CREA' | 'MODIFICA' | 'ELIMINA';
export type Origen = 'POS' | 'RRHH';

/** Quien hace el cambio, y quien lo autorizo si no era administrador. */
export interface Autor {
    origen: Origen;
    idusuario: number | null;
    nombre: string;
    autorizado_por?: number | null;
    autorizado_nombre?: string;
}

export interface Apunte {
    idorg: number;
    idsede_restobar: number;
    entidad: Entidad;
    identidad?: number | null;
    idcolaborador?: number | null;
    accion: Accion;
    detalle: string;
    anterior?: any;
    nuevo?: any;
}

/**
 * Deja el apunte. Nunca lanza: un fallo al auditar no debe impedir el cambio
 * que el usuario ya confirmo, pero si tiene que quedar en el log del servidor
 * para que alguien lo note.
 */
export async function anotar(a: Apunte, autor: Autor): Promise<void> {
    try {
        await prisma.asistencia_bitacora.create({
            data: {
                idorg: a.idorg,
                idsede_restobar: a.idsede_restobar,
                entidad: a.entidad as any,
                identidad: a.identidad ?? null,
                idcolaborador: a.idcolaborador ?? null,
                accion: a.accion as any,
                detalle: a.detalle.slice(0, 500),
                valor_anterior: a.anterior === undefined ? null : JSON.stringify(a.anterior),
                valor_nuevo: a.nuevo === undefined ? null : JSON.stringify(a.nuevo),
                origen: autor.origen as any,
                idusuario: autor.idusuario ?? null,
                usuario_nombre: (autor.nombre || '').slice(0, 120),
                autorizado_por: autor.autorizado_por ?? null,
                autorizado_nombre: (autor.autorizado_nombre || '').slice(0, 120),
                creado_at: fechaSql(ahoraLima())
            } as any
        });
    } catch (e) {
        console.error('[bitacora] no se pudo anotar', a.entidad, a.accion, e);
    }
}

// ---------------------------------------------------------------------------
// Frases legibles
// ---------------------------------------------------------------------------

const DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
const DIAS_TXT: any = { lun: 'Lun', mar: 'Mar', mie: 'Mie', jue: 'Jue', vie: 'Vie', sab: 'Sab', dom: 'Dom' };

/**
 * Horario en una linea, agrupando dias consecutivos con el mismo tramo.
 * "Lun-Vie 08:00-17:00 · Sab 10:00-14:00" se entiende de un vistazo; siete
 * lineas sueltas obligan a leerlas todas para ver que cambio.
 */
export function horarioATexto(h: HorarioSemanal | null | undefined): string {
    if (!h || !Object.keys(h).length) { return 'sin horario'; }

    const partes: string[] = [];
    let i = 0;
    while (i < DIAS.length) {
        const d = DIAS[i], t = h[d];
        if (!t) { i++; continue; }
        let j = i;
        while (j + 1 < DIAS.length) {
            const sig = h[DIAS[j + 1]];
            if (!sig || sig.e !== t.e || sig.s !== t.s) { break; }
            j++;
        }
        partes.push((j > i ? `${DIAS_TXT[d]}-${DIAS_TXT[DIAS[j]]}` : DIAS_TXT[d]) + ` ${t.e}-${t.s}`);
        i = j + 1;
    }
    return partes.join(' · ') || 'sin horario';
}

export function detalleHorario(nombre: string, antes: any, despues: any, tolAntes: number, tolDespues: number): string {
    const a = horarioATexto(antes), b = horarioATexto(despues);
    const cambioHorario = a !== b;
    const cambioTol = tolAntes !== tolDespues;

    if (cambioHorario && cambioTol) { return `${nombre}: ${a} -> ${b}; tolerancia ${tolAntes} -> ${tolDespues} min`; }
    if (cambioHorario) { return `${nombre}: ${a} -> ${b}`; }
    if (cambioTol) { return `${nombre}: tolerancia ${tolAntes} -> ${tolDespues} min`; }
    return `${nombre}: sin cambios`;
}

export function detalleExcepcion(quien: string, fecha: string, tipo: string, motivo: string,
                                 compensacion: string | null, sustituto: string | null): string {
    const que = tipo === 'LABORABLE' ? 'trabaja' : 'no trabaja';
    let txt = `${quien} ${que} el ${fecha} (${motivo})`;
    if (compensacion === 'RECARGO') { txt += ' - se paga con recargo'; }
    if (compensacion === 'SUSTITUTORIO') { txt += ` - descansa el ${sustituto}`; }
    return txt;
}
