export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
        <strong>Admin</strong>
        <nav style={{ display: "flex", gap: 16 }}>
          <a href="/ordenes">Órdenes</a>
          <a href="/inventario">Inventario</a>
          <a href="/compras">Compras</a>
          <a href="/usuarios">Usuarios</a>
          <a href="/reportes">Reportes</a>
        </nav>
      </header>
      <div style={{ padding: 20, maxWidth: 960, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
