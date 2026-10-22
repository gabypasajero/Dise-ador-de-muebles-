import type { SVGProps } from 'react';

function Base({ children, ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {children}
    </svg>
  );
}

export const IcoDeshacer = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Base>
);
export const IcoRehacer = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Base>
);
export const IcoUsuario = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Base>
);
export const IcoCarpeta = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </Base>
);
export const IcoGuardar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M7 3v6h8V3M7 21v-7h10v7" />
  </Base>
);
export const IcoPuerta = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 21V4a1 1 0 0 1 1-1h9v18" />
    <path d="M14 3l6 3v15h-6" />
    <circle cx="11" cy="12" r="0.6" fill="currentColor" />
  </Base>
);
export const IcoRegla = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3 17 17 3l4 4L7 21Z" />
    <path d="m7 13 2 2M10 10l2 2M13 7l2 2" />
  </Base>
);
export const IcoCubo = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 3 3 7.5v9L12 21l9-4.5v-9Z" />
    <path d="M3 7.5 12 12l9-4.5M12 12v9" />
  </Base>
);
export const IcoFrente = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <path d="M12 4v16" />
  </Base>
);
export const IcoArriba = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3 12h18M12 3v18" />
    <rect x="6" y="6" width="12" height="12" rx="1" />
  </Base>
);
export const IcoCentrar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);
export const IcoCamara = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Base>
);
export const IcoFoto = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5L5 20" />
  </Base>
);
export const IcoMas = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const IcoMenos = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M5 12h14" />
  </Base>
);
export const IcoX = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);
export const IcoIzq = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m15 6-6 6 6 6" />
  </Base>
);
export const IcoDer = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m9 6 6 6-6 6" />
  </Base>
);
export const IcoBasura = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Base>
);
export const IcoAviso = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 3 2 20h20Z" />
    <path d="M12 10v4M12 17h.01" />
  </Base>
);
export const IcoWsp = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...p}>
    <path
      fill="currentColor"
      d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"
    />
  </svg>
);
export const IcoCatalogo = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Base>
);
export const IcoSubir = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Base>
);
export const IcoReiniciar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Base>
);
export const IcoOjo = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);
export const IcoOjoTachado = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.5 3.4M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3 3 18 18" />
  </Base>
);
