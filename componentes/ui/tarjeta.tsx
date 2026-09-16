/**
 * La superficie sobre la que se apoya todo: una tarjeta de producto, un
 * bloque de formulario, una tabla. `relleno` en false cuando el
 * contenido llega hasta el borde (una tabla, una foto).
 */
export function Tarjeta({
  relleno = true,
  className,
  style,
  children,
}: {
  relleno?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={["tarjeta", relleno ? "tarjeta-relleno" : "", className ?? ""].filter(Boolean).join(" ")}
      style={style}
    >
      {children}
    </div>
  );
}

/** Una tabla dentro de una tarjeta, que se desplaza en vez de desbordar. */
export function TarjetaTabla({ children }: { children: React.ReactNode }) {
  return (
    <div className="tarjeta" style={{ overflow: "hidden" }}>
      <div className="tabla-envoltura">{children}</div>
    </div>
  );
}
