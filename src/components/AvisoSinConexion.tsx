import { useEffect, useState } from 'react';
import { backendBase } from '../datos';
import { enviarPendientes, listarPendientes } from '../datos/sinConexion';
import { useApp } from '../store/useApp';

/**
 * Aviso del modo sin conexión: sin internet se sigue diseñando y cotizando en la tablet; las
 * cotizaciones quedan pendientes y se envían solas al volver la conexión (o con «Enviar ahora»).
 */
export function AvisoSinConexion() {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const [pendientes, setPendientes] = useState(0);
  const [enviando, setEnviando] = useState(false);

  const contar = () => listarPendientes().then((l) => setPendientes(l.length));
  const enviar = async () => {
    setEnviando(true);
    try {
      const n = await enviarPendientes(backendBase);
      if (n) useApp.getState().avisar(n === 1 ? 'Se envió 1 cotización pendiente.' : `Se enviaron ${n} cotizaciones pendientes.`);
    } finally {
      setEnviando(false);
      contar();
    }
  };

  useEffect(() => {
    contar();
    const conectado = () => {
      setEnLinea(true);
      enviar();
    };
    const desconectado = () => setEnLinea(false);
    window.addEventListener('online', conectado);
    window.addEventListener('offline', desconectado);
    window.addEventListener('dto-pendientes', contar);
    // Al abrir con internet, se envía lo que haya quedado pendiente.
    if (navigator.onLine) enviar();
    return () => {
      window.removeEventListener('online', conectado);
      window.removeEventListener('offline', desconectado);
      window.removeEventListener('dto-pendientes', contar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (enLinea && !pendientes) return null;
  return (
    <div className={`aviso-sin-conexion${enLinea ? ' con-pendientes' : ''}`} role="status">
      {!enLinea ? (
        <>
          <strong>Sin conexión</strong> · trabajas en la tablet
          {pendientes > 0 ? ` · ${pendientes} ${pendientes === 1 ? 'cotización por enviar' : 'cotizaciones por enviar'}` : ''}. Al volver internet se envía todo solo.
        </>
      ) : (
        <>
          {pendientes} {pendientes === 1 ? 'cotización por enviar' : 'cotizaciones por enviar'}
          <button type="button" disabled={enviando} onClick={enviar}>
            {enviando ? 'Enviando…' : 'Enviar ahora'}
          </button>
        </>
      )}
    </div>
  );
}
