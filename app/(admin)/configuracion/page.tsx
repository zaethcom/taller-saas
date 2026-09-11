"use client";

/**
 * Personalización visual de la empresa: logo, color de marca, tema, y
 * los datos que aparecen en el encabezado y pie de cada recibo
 * impreso. Solo admin (personalizar_empresa) -- el layout de (admin)
 * ya oculta el enlace a quien no tenga el permiso, pero la ruta igual
 * se protege del lado del servidor en /api/configuracion.
 */
import { useEffect, useRef, useState } from "react";
import { subirLogo } from "@/lib/subir-logo";

interface Config {
  logoUrl: string | null;
  colorPrincipal: string;
  tema: "claro" | "oscuro" | "alto_contraste";
  reciboDireccion: string | null;
  reciboTelefono: string | null;
  reciboPie: string;
}

const TEMAS: { valor: Config["tema"]; etiqueta: string }[] = [
  { valor: "claro", etiqueta: "Claro" },
  { valor: "oscuro", etiqueta: "Oscuro" },
  { valor: "alto_contraste", etiqueta: "Alto contraste" },
];

export default function PaginaConfiguracion() {
  const [config, setConfig] = useState<Config | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputLogoRef = useRef<HTMLInputElement>(null);

  async function cargar() {
    try {
      const [resConfig, resPerfil] = await Promise.all([fetch("/api/configuracion"), fetch("/api/perfil")]);
      const datosConfig = await resConfig.json();
      const perfil = await resPerfil.json();
      if (!resConfig.ok) throw new Error(datosConfig.error ?? "No se pudo cargar la configuración");
      setConfig(datosConfig);
      if (resPerfil.ok) setEmpresaId(perfil.empresaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la configuración");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardar(cambios: Partial<Config>) {
    if (!config) return;
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch("/api/configuracion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setConfig({ ...config, ...cambios });
      setMensaje("Guardado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarLogo(archivo: File) {
    if (!empresaId) return;
    setSubiendoLogo(true);
    setError(null);
    try {
      const url = await subirLogo(empresaId, archivo);
      await guardar({ logoUrl: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el logo");
    } finally {
      setSubiendoLogo(false);
    }
  }

  if (!config) return <p>Cargando…</p>;

  return (
    <div>
      <h1>Configuración</h1>
      <p style={{ opacity: 0.6, fontSize: 14 }}>
        Los cambios de aquí se ven de inmediato en las tres puertas y en los próximos recibos
        impresos -- no hace falta volver a desplegar nada.
      </p>

      <section style={{ marginBottom: 28, maxWidth: 420 }}>
        <h2 style={{ fontSize: 16 }}>Logo</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="Logo actual" style={{ height: 48, width: 48, objectFit: "contain", borderRadius: 6 }} />
          ) : (
            <div style={{ height: 48, width: 48, borderRadius: 6, background: "var(--rule)" }} />
          )}
          <input
            ref={inputLogoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) cambiarLogo(archivo);
            }}
            disabled={subiendoLogo}
          />
        </div>
        {subiendoLogo && <p style={{ fontSize: 13, opacity: 0.7 }}>Subiendo…</p>}
      </section>

      <section style={{ marginBottom: 28, maxWidth: 420 }}>
        <h2 style={{ fontSize: 16 }}>Color de marca</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="color"
            value={config.colorPrincipal}
            onChange={(e) => setConfig({ ...config, colorPrincipal: e.target.value })}
            onBlur={(e) => guardar({ colorPrincipal: e.target.value })}
            style={{ width: 48, height: 36, padding: 0, border: "none" }}
          />
          <span style={{ fontFamily: "monospace" }}>{config.colorPrincipal}</span>
        </div>
      </section>

      <section style={{ marginBottom: 28, maxWidth: 420 }}>
        <h2 style={{ fontSize: 16 }}>Tema</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {TEMAS.map((t) => (
            <button
              key={t.valor}
              onClick={() => guardar({ tema: t.valor })}
              disabled={guardando}
              style={{ fontWeight: config.tema === t.valor ? 700 : 400 }}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 28, maxWidth: 420 }}>
        <h2 style={{ fontSize: 16 }}>Datos del recibo impreso</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            placeholder="Dirección"
            defaultValue={config.reciboDireccion ?? ""}
            onBlur={(e) => guardar({ reciboDireccion: e.target.value || null })}
            style={{ padding: 8 }}
          />
          <input
            placeholder="Teléfono"
            defaultValue={config.reciboTelefono ?? ""}
            onBlur={(e) => guardar({ reciboTelefono: e.target.value || null })}
            style={{ padding: 8 }}
          />
          <input
            placeholder="Mensaje al pie (ej. Gracias por su preferencia)"
            defaultValue={config.reciboPie}
            onBlur={(e) => guardar({ reciboPie: e.target.value || "Gracias por su preferencia" })}
            style={{ padding: 8 }}
          />
        </div>
      </section>

      {mensaje && <p style={{ color: "#4ade80" }}>{mensaje}</p>}
      {error && <p style={{ color: "#ff8080" }}>{error}</p>}
    </div>
  );
}
