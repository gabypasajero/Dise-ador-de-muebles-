import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './estilos.css';
import { useApp } from './store/useApp';

// En desarrollo se expone el estado para pruebas visuales automatizadas.
if (import.meta.env.DEV) (window as unknown as { __app: typeof useApp }).__app = useApp;

// Modo sin conexión: la app queda guardada en el equipo para abrirla sin internet.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
