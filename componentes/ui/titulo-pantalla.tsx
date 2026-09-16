/**
 * El encabezado de cada pantalla: qué es, qué hace, y los botones que
 * actúan sobre ella. Existe para que las veinte pantallas no vuelvan a
 * inventar cada una su propio <h1> con su propio tamaño.
 */
export function TituloPantalla({
  icono,
  titulo,
  descripcion,
  acciones,
}: {
  /** Elemento ya renderizado (<Wrench size={24} />), no el componente. */
  icono?: React.ReactNode;
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
        {icono && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 46,
              height: 46,
              borderRadius: "var(--r-md)",
              background: "var(--accent-suave)",
              color: "var(--accent)",
              flexShrink: 0,
            }}
          >
            {icono}
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <h1>{titulo}</h1>
          {descripcion && (
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--ink-2)" }}>{descripcion}</p>
          )}
        </div>
      </div>
      {acciones && <div className="fila">{acciones}</div>}
    </header>
  );
}
