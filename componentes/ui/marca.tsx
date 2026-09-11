/**
 * El logo y nombre de la empresa en el encabezado de cada puerta --
 * reemplaza el texto fijo "POS · nombre del usuario" por algo que de
 * verdad identifica de qué empresa es esta pantalla. Sin logo, cae en
 * un cuadro con la inicial del nombre, para que el encabezado nunca se
 * vea vacío mientras una empresa no ha subido el suyo.
 */
export function Marca({
  logoUrl,
  nombreEmpresa,
  etiqueta,
}: {
  logoUrl: string | null;
  nombreEmpresa: string;
  etiqueta: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- viene de Storage, no del proyecto: next/image exigiría configurar el dominio por empresa.
        <img src={logoUrl} alt={nombreEmpresa} style={{ height: 28, width: 28, objectFit: "contain", borderRadius: 4 }} />
      ) : (
        <div
          style={{
            height: 28,
            width: 28,
            borderRadius: 4,
            background: "var(--accent)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {nombreEmpresa.charAt(0).toUpperCase() || "?"}
        </div>
      )}
      <strong>
        {etiqueta} · {nombreEmpresa || "Taller SaaS"}
      </strong>
    </div>
  );
}
