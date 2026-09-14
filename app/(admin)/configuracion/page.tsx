"use client";

/**
 * Personalización visual de la empresa: logo, color de marca, tema, y
 * los datos que aparecen en el encabezado y pie de cada recibo
 * impreso. Solo admin (personalizar_empresa) -- el layout de (admin)
 * ya oculta el enlace a quien no tenga el permiso, pero la ruta igual
 * se protege del lado del servidor en /api/configuracion.
 *
 * El color se muestra sobre un botón de ejemplo, no solo como un
 * cuadrito: lo que importa no es el color en abstracto sino si el
 * texto blanco encima se sigue leyendo.
 */
import { useEffect, useRef, useState } from "react";
import { Settings, Check, ImagePlus } from "lucide-react";
import { subirLogo, subirImagenMarca } from "@/lib/subir-logo";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface Config {
  logoUrl: string | null;
  colorPrincipal: string;
  tema: "claro" | "oscuro" | "alto_contraste";
  reciboDireccion: string | null;
  reciboTelefono: string | null;
  reciboPie: string;
  imagenMarcaUrl: string | null;
  eslogan: string | null;
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
  const [subiendoMarca, setSubiendoMarca] = useState(false);
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

  async function cambiarImagenMarca(archivo: File) {
    if (!empresaId) return;
    setSubiendoMarca(true);
    setError(null);
    try {
      const url = await subirImagenMarca(empresaId, archivo);
      await guardar({ imagenMarcaUrl: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setSubiendoMarca(false);
    }
  }

  if (!config) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  return (
    <div>
      <TituloPantalla
        icono={<Settings size={24} strokeWidth={2} />}
        titulo="Configuración"
        descripcion="Los cambios se ven de inmediato en las tres puertas y en los próximos recibos impresos."
      />

      <div className="pila" style={{ maxWidth: 620 }}>
        <Tarjeta>
          <h2 style={{ marginBottom: 12 }}>Logo</h2>
          <div className="fila" style={{ gap: 14, flexWrap: "nowrap" }}>
            {config.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.logoUrl}
                alt="Logo actual"
                style={{ height: 56, width: 56, objectFit: "contain", borderRadius: "var(--r-md)", background: "var(--surface-2)", flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  height: 56,
                  width: 56,
                  borderRadius: "var(--r-md)",
                  background: "var(--surface-2)",
                  color: "var(--ink-3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ImagePlus size={24} strokeWidth={1.8} aria-hidden />
              </div>
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
              aria-label="Logo de la empresa"
              style={{ height: "auto", padding: 10 }}
            />
          </div>
          <p className="campo-ayuda">
            {subiendoLogo ? "Subiendo…" : "Se ve en el menú lateral y en la pantalla de inicio de sesión."}
          </p>
        </Tarjeta>

        <Tarjeta>
          <h2 style={{ marginBottom: 12 }}>Color de marca</h2>
          <div className="fila" style={{ gap: 14 }}>
            <input
              type="color"
              value={config.colorPrincipal}
              onChange={(e) => setConfig({ ...config, colorPrincipal: e.target.value })}
              onBlur={(e) => guardar({ colorPrincipal: e.target.value })}
              aria-label="Color de marca"
              style={{ width: 56, height: 44, padding: 4, flexShrink: 0 }}
            />
            <span className="cifra" style={{ fontWeight: 700, letterSpacing: "0.04em" }}>
              {config.colorPrincipal}
            </span>
            <span
              className="btn btn-primario"
              style={{ background: config.colorPrincipal, cursor: "default", marginLeft: "auto" }}
            >
              Así se ve el botón de cobro
            </span>
          </div>
          <p className="campo-ayuda">
            Es el color de la acción en toda la aplicación. Los estados (verde, ámbar, rojo) no cambian con él.
          </p>
        </Tarjeta>

        <Tarjeta>
          <h2 style={{ marginBottom: 12 }}>Tema</h2>
          <div className="fila" style={{ gap: 8 }}>
            {TEMAS.map((t) => (
              <Boton
                key={t.valor}
                variante={config.tema === t.valor ? "primario" : "contorno"}
                onClick={() => guardar({ tema: t.valor })}
                disabled={guardando}
                aria-pressed={config.tema === t.valor}
              >
                {t.etiqueta}
              </Boton>
            ))}
          </div>
          <p className="campo-ayuda">La puerta del taller es siempre oscura, sin importar lo que se elija aquí.</p>
        </Tarjeta>

        <Tarjeta>
          <h2 style={{ marginBottom: 12 }}>Bloque de marca (pie del menú lateral)</h2>
          <div className="fila" style={{ gap: 14, flexWrap: "nowrap" }}>
            {config.imagenMarcaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.imagenMarcaUrl}
                alt="Imagen de marca actual"
                style={{ height: 56, width: 96, objectFit: "cover", borderRadius: "var(--r-md)", flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  height: 56,
                  width: 96,
                  borderRadius: "var(--r-md)",
                  background: "var(--surface-2)",
                  color: "var(--ink-3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ImagePlus size={24} strokeWidth={1.8} aria-hidden />
              </div>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) cambiarImagenMarca(archivo);
              }}
              disabled={subiendoMarca}
              aria-label="Imagen de marca"
              style={{ height: "auto", padding: 10 }}
            />
          </div>
          <p className="campo-ayuda">
            {subiendoMarca
              ? "Subiendo…"
              : "Una foto y un eslogan cortos, debajo del menú en las tres puertas. Sin foto no se muestra nada."}
          </p>
          <div style={{ marginTop: 12 }}>
            <Campo etiqueta="Eslogan">
              <input
                placeholder="Ej. Movilidad sin límites"
                defaultValue={config.eslogan ?? ""}
                onBlur={(e) => guardar({ eslogan: e.target.value || null })}
              />
            </Campo>
          </div>
        </Tarjeta>

        <Tarjeta>
          <h2 style={{ marginBottom: 12 }}>Datos del recibo impreso</h2>
          <div className="pila" style={{ gap: 12 }}>
            <Campo etiqueta="Dirección">
              <input
                placeholder="Calle 00 # 00-00"
                defaultValue={config.reciboDireccion ?? ""}
                onBlur={(e) => guardar({ reciboDireccion: e.target.value || null })}
              />
            </Campo>
            <Campo etiqueta="Teléfono">
              <input
                placeholder="300 000 0000"
                defaultValue={config.reciboTelefono ?? ""}
                onBlur={(e) => guardar({ reciboTelefono: e.target.value || null })}
                className="cifra"
              />
            </Campo>
            <Campo etiqueta="Mensaje al pie" ayuda="Se guarda al salir del campo.">
              <input
                placeholder="Ej. Gracias por su preferencia"
                defaultValue={config.reciboPie}
                onBlur={(e) => guardar({ reciboPie: e.target.value || "Gracias por su preferencia" })}
              />
            </Campo>
          </div>
        </Tarjeta>

        {mensaje && (
          <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
            {mensaje}
          </Aviso>
        )}
        {error && <Aviso tono="peligro">{error}</Aviso>}
      </div>
    </div>
  );
}
