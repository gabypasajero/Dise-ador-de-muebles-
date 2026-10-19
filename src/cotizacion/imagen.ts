// Utilidades de imagen en el navegador: versión chica de la captura 3D para la lista.

/** Reduce una imagen (data URL) a `ancho` px como JPEG. Si algo falla devuelve null. */
export function reducirImagen(dataUrl: string, ancho = 480, calidad = 0.82): Promise<string | null> {
  return new Promise((resolver) => {
    const img = new Image();
    img.onload = () => {
      try {
        const escala = Math.min(1, ancho / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * escala));
        c.height = Math.max(1, Math.round(img.naturalHeight * escala));
        const g = c.getContext('2d');
        if (!g) return resolver(null);
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, c.width, c.height);
        resolver(c.toDataURL('image/jpeg', calidad));
      } catch {
        resolver(null);
      }
    };
    img.onerror = () => resolver(null);
    img.src = dataUrl;
  });
}
