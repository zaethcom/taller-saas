"use client";

/**
 * Captura de evidencia: foto o video, en cualquier momento del proceso
 * -- no solo entrada y salida (esas dos siguen siendo las que exige
 * la máquina de estados en lib/estados.ts; "general" es para
 * documentar algo a mitad de la reparación, sin mover ningún estado).
 *
 * El video estaba contemplado en el esquema desde 0008_ajustes_requisitos.sql
 * pero el plano original lo dejaba fuera de la v1 por peso y por la
 * red del taller. Se activa aquí con un límite de 50MB por archivo
 * (0012_limite_evidencia.sql) -- sigue pesando más que una foto, así
 * que el aviso en pantalla es real, no decorativo.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Camera, Video, PenLine, Check, Eye } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { subirEvidencia } from "@/lib/subir-evidencia";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

type Fase = "entrada" | "salida" | "";

interface Evidencia {
  id: string;
  tipo: "foto" | "video" | "firma";
  fase: string | null;
  visible_cliente: boolean;
  tomada_en: string;
}

const LIMITE_BYTES = 50 * 1024 * 1024;

/** Cada tipo con su ícono, para leer la lista de un vistazo. */
function IconoTipo({ tipo }: { tipo: Evidencia["tipo"] }) {
  if (tipo === "video") return <Video size={17} strokeWidth={2} aria-label="Video" />;
  if (tipo === "firma") return <PenLine size={17} strokeWidth={2} aria-label="Firma" />;
  return <Camera size={17} strokeWidth={2} aria-label="Foto" />;
}

export default function PaginaEvidencia() {
  const { id } = useParams<{ id: string }>();
  const inputRef = useRef<HTMLInputElement>(null);

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [fase, setFase] = useState<Fase>("");
  const [visibleCliente, setVisibleCliente] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const supabase = clienteNavegador();
    const { data } = await supabase
      .from("evidencia")
      .select("id, tipo, fase, visible_cliente, tomada_en")
      .eq("orden_id", id)
      .order("tomada_en", { ascending: false });
    setEvidencias(data ?? []);
  }, [id]);

  useEffect(() => {
    fetch("/api/perfil")
      .then((r) => r.json())
      .then((p) => setEmpresaId(p.empresaId))
      .catch(() => {});
    cargar();
  }, [id, cargar]);

  async function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo || !empresaId) return;

    setError(null);
    setMensaje(null);

    if (archivo.size > LIMITE_BYTES) {
      setError(
        `El archivo pesa ${(archivo.size / 1024 / 1024).toFixed(1)}MB. El límite es 50MB -- ` +
          `graba un video más corto o toma la foto de nuevo.`,
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const esVideo = archivo.type.startsWith("video/");
    const extension = archivo.name.split(".").pop() || (esVideo ? "mp4" : "jpg");

    setSubiendo(true);
    try {
      await subirEvidencia({
        empresaId,
        ordenId: id,
        archivo,
        extension,
        tipo: esVideo ? "video" : "foto",
        fase: fase || undefined,
        visibleCliente,
      });
      setMensaje(`${esVideo ? "Video" : "Foto"} subido.`);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <TituloPantalla
        icono={<Camera size={24} strokeWidth={2} />}
        titulo="Evidencia"
        descripcion="Foto o video del equipo, en cualquier momento de la reparación."
      />

      <div className="pila">
        <Tarjeta>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <Campo etiqueta="Fase">
              <select value={fase} onChange={(e) => setFase(e.target.value as Fase)}>
                <option value="">General (no mueve el estado)</option>
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </select>
            </Campo>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={visibleCliente}
                  onChange={(e) => setVisibleCliente(e.target.checked)}
                  style={{ width: 20, height: 20, padding: 0, accentColor: "var(--accent)" }}
                />
                <Eye size={16} strokeWidth={2} color="var(--ink-2)" aria-hidden />
                Visible para el cliente
              </label>
            </div>
          </div>

          <p className="campo-ayuda" style={{ marginBottom: 12 }}>
            Foto o video, hasta 50MB. Un video pesa mucho más que una foto en una red mala del taller --
            prefiere clips cortos (10-15 segundos alcanzan para mostrar el problema).
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            onChange={subirArchivo}
            disabled={subiendo || !empresaId}
            aria-label="Archivo de evidencia"
            style={{ height: "auto", padding: 10 }}
          />
          {subiendo && <p style={{ marginTop: 10, fontSize: 13, color: "var(--ink-2)" }}>Subiendo…</p>}
        </Tarjeta>

        {mensaje && (
          <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
            {mensaje}
          </Aviso>
        )}
        {error && <Aviso tono="peligro">{error}</Aviso>}

        <Tarjeta>
          <h2 style={{ marginBottom: evidencias.length ? 4 : 10 }}>Ya subido</h2>
          {evidencias.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Todavía no hay evidencia.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {evidencias.map((ev) => (
                <li
                  key={ev.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 0",
                    borderBottom: "1px solid var(--rule)",
                    fontSize: 14,
                  }}
                >
                  <span style={{ display: "flex", color: "var(--ink-2)" }}>
                    <IconoTipo tipo={ev.tipo} />
                  </span>
                  {ev.fase && <Etiqueta tono="info">{ev.fase}</Etiqueta>}
                  {ev.visible_cliente && <Etiqueta tono="ok">Visible al cliente</Etiqueta>}
                  <span className="cifra" style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-3)" }}>
                    {new Date(ev.tomada_en).toLocaleString("es-CO")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
