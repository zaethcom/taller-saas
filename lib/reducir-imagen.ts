/**
 * Achica una imagen en el navegador antes de subirla: lado mayor de
 * `ladoMaximo` puntos, en JPEG. Para fondos de pantalla, donde una foto
 * o un banner de varios MB no se ve mejor pero sí tarda más en cargar
 * el login y es más fácil que la subida se corte a medias.
 *
 * Si el navegador no puede decodificarla (formato raro), devuelve el
 * archivo original y la subida sigue como antes.
 */
export async function reducirImagen(archivo: File, ladoMaximo = 1920, calidad = 0.85): Promise<File> {
  try {
    const mapa = await createImageBitmap(archivo);
    const escala = Math.min(1, ladoMaximo / Math.max(mapa.width, mapa.height));
    const ancho = Math.round(mapa.width * escala);
    const alto = Math.round(mapa.height * escala);

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return archivo;
    // JPEG no tiene transparencia: lo transparente queda negro, como el
    // fondo del login detrás de la imagen.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(mapa, 0, 0, ancho, alto);
    mapa.close();

    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", calidad));
    if (!blob) return archivo;
    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch {
    return archivo;
  }
}
