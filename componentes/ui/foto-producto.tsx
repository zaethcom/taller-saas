"use client";

/**
 * La foto de un repuesto o un artículo, en las tarjetas de /inventario
 * y /vender. Sin foto, cae en un ícono según el tipo -- mismo patrón que
 * el logo de empresa cayendo en su inicial (componentes/ui/marca.tsx ya
 * desaparecido, pero la idea sigue viva aquí).
 *
 * `editable` controla si aparece el control para subir/cambiar la foto
 * -- true en /inventario (donde se administra el catálogo), false en
 * /vender (donde solo se busca y se agrega al carrito).
 */
import { useState } from "react";
import { Wrench, Package, ImagePlus } from "lucide-react";
import { subirImagenProducto } from "@/lib/subir-imagen-producto";

export function FotoProducto({
  tipo,
  id,
  empresaId,
  imagenUrl,
  editable,
}: {
  tipo: "repuesto" | "articulo";
  id: string;
  // Solo hace falta cuando editable=true (/inventario) -- en /vender,
  // que solo muestra la foto, nunca se usa.
  empresaId?: string;
  imagenUrl: string | null;
  editable: boolean;
}) {
  const [url, setUrl] = useState(imagenUrl);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo || !empresaId) return;

    setSubiendo(true);
    setError(null);
    try {
      const nuevaUrl = await subirImagenProducto(empresaId, tipo, id, archivo);
      const ruta = tipo === "repuesto" ? `/api/repuestos/${id}` : `/api/inventario/articulos/${id}`;
      const res = await fetch(ruta, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenUrl: nuevaUrl }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "no se pudo guardar la foto");
      setUrl(nuevaUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- viene de Storage, no del proyecto.
        <img
          src={url}
          alt=""
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            objectFit: "cover",
            borderRadius: "var(--r-md)",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: "var(--r-md)",
            background: "var(--surface-2)",
            color: "var(--ink-3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {tipo === "repuesto" ? (
            <Wrench size={40} strokeWidth={1.6} aria-hidden />
          ) : (
            <Package size={40} strokeWidth={1.6} aria-hidden />
          )}
        </div>
      )}
      {editable && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            marginTop: 6,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--ink-2)",
            cursor: subiendo ? "progress" : "pointer",
            opacity: subiendo ? 0.5 : 1,
          }}
        >
          <ImagePlus size={13} strokeWidth={2} aria-hidden />
          {subiendo ? "Subiendo…" : url ? "Cambiar foto" : "Agregar foto"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={manejarArchivo}
            disabled={subiendo}
            style={{ display: "none" }}
          />
        </label>
      )}
      {error && <div style={{ fontSize: 10, color: "var(--peligro)", textAlign: "center", marginTop: 2 }}>{error}</div>}
    </div>
  );
}
