/**
 * La envoltura de un control de formulario: etiqueta arriba, ayuda o
 * error abajo. El control en sí sigue siendo un <input>/<select>/
 * <textarea> nativo -- globals.css ya los viste a todos, así que no
 * hace falta un componente por cada tipo.
 */
export function Campo({
  etiqueta,
  ayuda,
  error,
  children,
}: {
  etiqueta?: string;
  ayuda?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className={error ? "campo-invalido" : undefined} style={{ display: "block" }}>
      {etiqueta && <span className="campo-etiqueta">{etiqueta}</span>}
      {children}
      {error ? <div className="campo-error">{error}</div> : ayuda ? <div className="campo-ayuda">{ayuda}</div> : null}
    </label>
  );
}

/** Un mensaje de resultado: lo que salió bien, lo que falló, lo que falta. */
export function Aviso({
  tono = "info",
  icono,
  children,
}: {
  tono?: "ok" | "info" | "aviso" | "peligro";
  icono?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`aviso aviso-${tono}`} role={tono === "peligro" ? "alert" : undefined}>
      {icono && <span style={{ flexShrink: 0, marginTop: 1 }}>{icono}</span>}
      <div>{children}</div>
    </div>
  );
}
