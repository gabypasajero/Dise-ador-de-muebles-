import { useState, type FormEvent } from 'react';
import { backend } from '../datos';
import { useApp } from '../store/useApp';
import { IcoOjo, IcoOjoTachado } from './Iconos';

/** Pantalla a la que llega el vendedor desde el enlace de recuperación del correo. */
export function NuevaClave({ alTerminar }: { alTerminar: () => void }) {
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const sesion = useApp((s) => s.sesion);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== repetir) return setError('Las contraseñas no coinciden');
    setEnviando(true);
    try {
      await backend.cambiarClave(password);
      useApp.getState().avisar('Contraseña actualizada');
      alTerminar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="acceso">
      <section className="acceso-tarjeta" aria-label="Crear contraseña nueva">
        <h2>Crear contraseña nueva</h2>
        {sesion !== 'activa' ? (
          <>
            <p className="error" role="alert">
              El enlace venció o ya se usó. Pide uno nuevo desde «¿Olvidaste tu contraseña?».
            </p>
            <button type="button" className="boton primario ancho" onClick={alTerminar}>
              Volver al ingreso
            </button>
          </>
        ) : (
          <form className="formulario" onSubmit={enviar}>
            <label>
              Contraseña nueva
              <span className="campo-clave">
                <input
                  type={verClave ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="ver-clave"
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={verClave}
                  onClick={() => setVerClave((v) => !v)}
                >
                  {verClave ? <IcoOjoTachado /> : <IcoOjo />}
                </button>
              </span>
              <small className="tenue">Mínimo 8 caracteres.</small>
            </label>
            <label>
              Repite la contraseña
              <input
                type={verClave ? 'text' : 'password'}
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="boton primario ancho" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
