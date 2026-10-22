/**
 * El encabezado de cada pantalla: su nombre y los botones que actúan
 * sobre ella. Existe para que las pantallas no vuelvan a inventar cada
 * una su propio <h1> con su propio tamaño.
 *
 * Sin ícono ni frase de ayuda por defecto: el menú ya dice dónde se
 * está. `descripcion` queda para un dato que no se ve en otro lado (la
 * hora en que se abrió el turno, por ejemplo).
 */
export function TituloPantalla({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1>{titulo}</h1>
        {descripcion && <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink-2)" }}>{descripcion}</p>}
      </div>
      {acciones && <div className="fila">{acciones}</div>}
    </header>
  );
}
