/**
 * Puerta de caja: denso, de teclado, tablas y atajos. Corre en tablet
 * o computador, en las dos sedes.
 */
export default function LayoutPos({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
        <strong>POS</strong>
        <nav style={{ display: "flex", gap: 16 }}>
          <a href="/vender">Vender</a>
          <a href="/recibir">Recibir equipo</a>
          <a href="/entregar">Entregar</a>
          <a href="/turno">Turno</a>
        </nav>
      </header>
      <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
