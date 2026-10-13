import type { Backend } from './backend';
import { backendLocal } from './local';
import { backendSupabase } from './supabase';

/** Backend activo: Supabase por defecto, local con VITE_BACKEND=local (demostración). */
export const backend: Backend = import.meta.env.VITE_BACKEND === 'local' ? backendLocal : backendSupabase;

export { calcularTotales } from './backend';
export type { DatosRegistro } from './backend';
