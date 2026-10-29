import type { Backend } from './backend';
import { backendLocal } from './local';
import { backendSupabase } from './supabase';
import { conModoSinConexion } from './sinConexion';

/** Backend activo: Supabase por defecto, local con VITE_BACKEND=local (demostración). */
// Supabase va con el modo sin conexión: sin internet se sigue trabajando y las cotizaciones se envían al volver.
export const backendBase: Backend = import.meta.env.VITE_BACKEND === 'local' ? backendLocal : backendSupabase;
export const backend: Backend = backendBase.tipo === 'supabase' ? conModoSinConexion(backendBase) : backendBase;

export { calcularTotales } from './backend';
export type { DatosRegistro } from './backend';
