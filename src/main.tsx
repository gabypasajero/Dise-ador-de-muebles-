import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './estilos.css';
import { useApp } from './store/useApp';

// En desarrollo se expone el estado para pruebas visuales automatizadas.
if (import.meta.env.DEV) (window as unknown as { __app: typeof useApp }).__app = useApp;

// Modo sin conexión: la app queda guardada en el equipo para abrirla sin internet.
// Se registra apenas abre (sin esperar), para guardar todo lo antes posible.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const CLAVE = 'dto-sin-conexion-version';
  navigator.serviceWorker.addEventListener('message', (e) => {
    const m = e.data as { tipo?: string; version?: string } | null;
    if (m?.tipo !== 'listo-sin-conexion' || !m.version) return;
    let antes: string | null = null;
    try {
      antes = localStorage.getItem(CLAVE);
      localStorage.setItem(CLAVE, m.version);
    } catch {
      /* sin almacenamiento */
    }
    // Se avisa una vez por versión: ya se puede usar sin internet.
    if (antes !== m.version) useApp.getState().avisar('✓ Lista para usar sin internet: ya puedes desconectarte.');
  });
  navigator.serviceWorker
    .register('/sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then((r) => r.active?.postMessage({ tipo: 'estado-sin-conexion' }))
    .catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
