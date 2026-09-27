/**
 * El bloque de marca al pie del menú lateral: la foto y el eslogan que
 * cada empresa configura en /configuracion (lib/configuracion.ts,
 * imagenMarcaUrl y eslogan). Sin foto configurada no se muestra nada --
 * un recuadro vacío sería peor que no tener el bloque.
 */
export function BloqueMarca({ imagenUrl, eslogan }: { imagenUrl: string | null; eslogan: string | null }) {
  if (!imagenUrl) return null;

  return (
    <div style={{ position: "relative", minHeight: 160, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imagenUrl}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, transparent 0%, rgba(11,20,24,0.85) 75%)",
        }}
      />
      {eslogan && (
        <p
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 14,
            margin: 0,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.25,
            textTransform: "uppercase",
          }}
        >
          {eslogan}
        </p>
      )}
    </div>
  );
}
