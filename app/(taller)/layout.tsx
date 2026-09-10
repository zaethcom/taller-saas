/**
 * Puerta del técnico. Botones grandes, una tarea por pantalla -- se usa
 * con guantes y con una sola mano mientras se sostiene el equipo.
 *
 * El control de acceso real (sesión + rol "tecnico") va aquí una vez
 * exista el flujo de login -- ver lib/permisos.ts puedeEntrarA("taller").
 */
export default function LayoutTaller({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0b1418", color: "white" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid #223038" }}>
        <strong>Taller</strong>
      </header>
      <div style={{ padding: 20, maxWidth: 480, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
