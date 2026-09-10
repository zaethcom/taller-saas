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
import { clienteNavegador } from "@/lib/supabase/cliente";
import { subirEvidencia } from "@/lib/subir-evidencia";

type Fase = "entrada" | "salida" | "";

interface Evidencia {
  id: string;
  tipo: "foto" | "video" | "firma";
  fase: string | null;
  visible_cliente: boolean;
  tomada_en: string;
}

const LIMITE_BYTES = 50 * 1024 * 1024;

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
      <h1>Evidencia</h1>

      <section style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          <label>
            Fase:{" "}
            <select value={fase} onChange={(e) => setFase(e.target.value as Fase)} style={{ padding: 6 }}>
              <option value="">General (no mueve el estado)</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={visibleCliente}
              onChange={(e) => setVisibleCliente(e.target.checked)}
            />
            Visible para el cliente en /seguimiento
          </label>
        </div>

        <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 10 }}>
          Foto o video, hasta 50MB. Un video pesa mucho más que una foto en una red mala del
          taller -- prefiere clips cortos (10-15 segundos alcanzan para mostrar el problema).
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={subirArchivo}
          disabled={subiendo || !empresaId}
        />
        {subiendo && <p>Subiendo…</p>}
        {mensaje && <p style={{ color: "#4ade80" }}>{mensaje}</p>}
        {error && <p style={{ color: "#ff8080" }}>{error}</p>}
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>Ya subido</h2>
        {evidencias.length === 0 && <p style={{ opacity: 0.6 }}>Todavía no hay evidencia.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {evidencias.map((ev) => (
            <li
              key={ev.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid #223038",
                fontSize: 14,
              }}
            >
              <span>
                {ev.tipo === "video" ? "🎥" : ev.tipo === "firma" ? "✍️" : "📷"}{" "}
                {ev.fase ? `· ${ev.fase}` : ""} {ev.visible_cliente ? "· visible al cliente" : ""}
              </span>
              <span style={{ opacity: 0.6 }}>{new Date(ev.tomada_en).toLocaleString("es-CO")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
