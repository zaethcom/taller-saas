"use client";

/**
 * Personalización visual de la empresa: logo, color de marca, tema, y
 * los datos que aparecen en el encabezado y pie de cada recibo
 * impreso. Solo admin (personalizar_empresa) -- el layout de (admin)
 * ya oculta el enlace a quien no tenga el permiso, pero la ruta igual
 * se protege del lado del servidor en /api/configuracion.
 *
 * Va en cuatro pestañas (Empresa, Recibos y etiquetas, Taller,
 * Impresoras) en vez de una sola columna larga; lo de marca que casi
 * no se toca (fondo de inicio, bloque del menú) queda plegado en "Más
 * opciones de marca".
 *
 * El color se muestra sobre un botón de ejemplo, no solo como un
 * cuadrito: lo que importa no es el color en abstracto sino si el
 * texto blanco encima se sigue leyendo.
 */
import { useEffect, useState } from "react";
import { Settings, Check, ImagePlus, ChevronDown } from "lucide-react";
import { subirLogo, subirImagenMarca, subirFondoLogin } from "@/lib/subir-logo";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { PlantillasEtiqueta } from "@/componentes/etiquetas/plantillas-etiqueta";
import { ConfigFases } from "@/componentes/taller/config-fases";
import { ImpresorasUsbEsteEquipo } from "@/componentes/estacion/impresoras-usb";
import { DescargaPuente } from "@/componentes/estacion/descarga-puente";
import { VentanaError } from "@/componentes/ui/ventana-error";

interface Config {
  logoUrl: string | null;
  colorPrincipal: string;
  tema: "claro" | "oscuro" | "alto_contraste";
  reciboDireccion: string | null;
  reciboTelefono: string | null;
  reciboPie: string;
  imagenMarcaUrl: string | null;
  eslogan: string | null;
  whatsappProveedor: string | null;
  prefijoEtiqueta: string;
  fondoLoginUrl: string | null;
  codigo: string | null;
  tipoNegocio: "celular" | "computador" | "patineta" | "otro" | null;
}

const TEMAS: { valor: Config["tema"]; etiqueta: string }[] = [
  { valor: "claro", etiqueta: "Claro" },
  { valor: "oscuro", etiqueta: "Oscuro" },
  { valor: "alto_contraste", etiqueta: "Alto contraste" },
];

const TIPOS_NEGOCIO: { valor: NonNullable<Config["tipoNegocio"]>; etiqueta: string }[] = [
  { valor: "celular", etiqueta: "Celulares" },
  { valor: "computador", etiqueta: "Computadores" },
  { valor: "patineta", etiqueta: "Patinetas" },
  { valor: "otro", etiqueta: "Otro" },
];

type Pestana = "empresa" | "recibos" | "taller" | "impresoras";

const PESTANAS: { valor: Pestana; etiqueta: string }[] = [
  { valor: "empresa", etiqueta: "Empresa" },
  { valor: "recibos", etiqueta: "Recibos y etiquetas" },
  { valor: "taller", etiqueta: "Taller" },
  { valor: "impresoras", etiqueta: "Impresoras" },
];

export default function PaginaConfiguracion() {
  const [config, setConfig] = useState<Config | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [subiendoMarca, setSubiendoMarca] = useState(false);
  const [subiendoFondo, setSubiendoFondo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("empresa");

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

  async function cambiarFondoLogin(archivo: File) {
    if (!empresaId) return;
    setSubiendoFondo(true);
    setError(null);
    try {
      const url = await subirFondoLogin(empresaId, archivo);
      await guardar({ fondoLoginUrl: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el fondo");
    } finally {
      setSubiendoFondo(false);
    }
  }

  if (!config) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  return (
    <div>
      <style>{`
        .config-pestanas{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;margin-bottom:16px;}
        .config-renglon{display:grid;grid-template-columns:150px minmax(0,1fr);gap:8px 14px;align-items:center;padding:12px 0;border-top:1px solid var(--rule);}
        .config-renglon:first-child{border-top:none;padding-top:0;}
        .config-renglon:last-child{padding-bottom:0;}
        .config-renglon>.campo-etiqueta{margin:0;}
        @media (max-width:560px){.config-renglon{grid-template-columns:minmax(0,1fr);}}
        .config-mas>summary{cursor:pointer;font-weight:700;font-size:14px;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;}
        .config-mas>summary::-webkit-details-marker{display:none;}
        .config-mas[open]>summary svg{transform:rotate(180deg);}
      `}</style>
      <TituloPantalla icono={<Settings size={24} strokeWidth={2} />} titulo="Configuración" />

      <div style={{ maxWidth: 620 }}>
        <div className="config-pestanas" role="tablist" aria-label="Secciones de la configuración">
          {PESTANAS.map((p) => (
            <button
              key={p.valor}
              type="button"
              role="tab"
              aria-selected={pestana === p.valor}
              onClick={() => setPestana(p.valor)}
              className={`pastilla${pestana === p.valor ? " pastilla-activa" : ""}`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        <div className="pila" role="tabpanel">
          {pestana === "empresa" && (
            <>
              <Tarjeta>
                <div className="config-renglon">
                  <span className="campo-etiqueta">Logo</span>
                  <div className="fila" style={{ gap: 12, flexWrap: "nowrap" }}>
                    {config.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={config.logoUrl}
                        alt="Logo actual"
                        style={{ height: 48, width: 48, objectFit: "contain", borderRadius: "var(--r-md)", background: "var(--surface-2)", flexShrink: 0 }}
                      />
                    ) : (
                      <CuadroVacio ancho={48} />
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => {
                        const archivo = e.target.files?.[0];
                        if (archivo) cambiarLogo(archivo);
                      }}
                      disabled={subiendoLogo}
                      aria-label="Logo de la empresa"
                      style={{ height: "auto", padding: 8, minWidth: 0 }}
                    />
                  </div>
                </div>

                <div className="config-renglon">
                  <span className="campo-etiqueta">Color de marca</span>
                  <div className="fila" style={{ gap: 12 }}>
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
                      Botón de ejemplo
                    </span>
                  </div>
                </div>

                <div className="config-renglon">
                  <span className="campo-etiqueta">Tema</span>
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
                </div>

                <div className="config-renglon">
                  <span className="campo-etiqueta">Código de acceso</span>
                  <div>
                    <input
                      placeholder="Ej. polaco-scooter"
                      defaultValue={config.codigo ?? ""}
                      onBlur={(e) => guardar({ codigo: e.target.value.trim().toLowerCase() || null })}
                      className="cifra"
                      aria-label="Código de acceso"
                    />
                    <p className="campo-ayuda">Se escribe en el inicio de sesión para ver el logo y el fondo de la empresa.</p>
                  </div>
                </div>
              </Tarjeta>

              <Tarjeta>
                <details className="config-mas">
                  <summary>
                    Más opciones de marca
                    <ChevronDown size={18} strokeWidth={2} aria-hidden />
                  </summary>
                  <div className="pila" style={{ gap: 18, marginTop: 14 }}>
                    <div>
                      <div className="campo-etiqueta">Fondo de inicio de sesión</div>
                      <div
                        style={{
                          height: 120,
                          borderRadius: "var(--r-md)",
                          marginBottom: 10,
                          background: config.fondoLoginUrl
                            ? `#000 url(${config.fondoLoginUrl}) center/cover no-repeat`
                            : "var(--chrome)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--chrome-apagado)",
                        }}
                      >
                        {!config.fondoLoginUrl && <span style={{ fontSize: 13 }}>Negro (sin imagen)</span>}
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          const archivo = e.target.files?.[0];
                          if (archivo) cambiarFondoLogin(archivo);
                        }}
                        disabled={subiendoFondo}
                        aria-label="Fondo de inicio de sesión"
                        style={{ height: "auto", padding: 8 }}
                      />
                      {subiendoFondo && <p className="campo-ayuda">Subiendo…</p>}
                    </div>

                    <div>
                      <div className="campo-etiqueta">Bloque de marca (pie del menú lateral)</div>
                      <div className="fila" style={{ gap: 12, flexWrap: "nowrap" }}>
                        {config.imagenMarcaUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={config.imagenMarcaUrl}
                            alt="Imagen de marca actual"
                            style={{ height: 48, width: 84, objectFit: "cover", borderRadius: "var(--r-md)", flexShrink: 0 }}
                          />
                        ) : (
                          <CuadroVacio ancho={84} />
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
                          style={{ height: "auto", padding: 8, minWidth: 0 }}
                        />
                      </div>
                      <p className="campo-ayuda">{subiendoMarca ? "Subiendo…" : "Sin foto no se muestra nada."}</p>
                      <div style={{ marginTop: 10 }}>
                        <Campo etiqueta="Eslogan">
                          <input
                            placeholder="Ej. Movilidad sin límites"
                            defaultValue={config.eslogan ?? ""}
                            onBlur={(e) => guardar({ eslogan: e.target.value || null })}
                          />
                        </Campo>
                      </div>
                    </div>
                  </div>
                </details>
              </Tarjeta>
            </>
          )}

          {pestana === "recibos" && (
            <>
              <Tarjeta>
                <h2 style={{ marginBottom: 12 }}>Recibo impreso</h2>
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
                  <Campo etiqueta="Mensaje al pie">
                    <input
                      placeholder="Ej. Gracias por su preferencia"
                      defaultValue={config.reciboPie}
                      onBlur={(e) => guardar({ reciboPie: e.target.value || "Gracias por su preferencia" })}
                    />
                  </Campo>
                  <Campo
                    etiqueta="Prefijo del código de entrada"
                    ayuda='Va antes del número de orden en la etiqueta: "PS" da "PS000123".'
                  >
                    <input
                      placeholder="OR"
                      defaultValue={config.prefijoEtiqueta}
                      maxLength={6}
                      onBlur={(e) => guardar({ prefijoEtiqueta: (e.target.value.trim() || "OR").toUpperCase() })}
                      className="cifra"
                      style={{ maxWidth: 120, textTransform: "uppercase" }}
                    />
                  </Campo>
                </div>
              </Tarjeta>

              <PlantillasEtiqueta empresaId={empresaId} />
            </>
          )}

          {pestana === "taller" && (
            <>
              <Tarjeta>
                <h2 style={{ marginBottom: 12 }}>Tipo de negocio</h2>
                <div className="fila" style={{ gap: 8 }}>
                  {TIPOS_NEGOCIO.map((t) => (
                    <Boton
                      key={t.valor}
                      variante={config.tipoNegocio === t.valor ? "primario" : "contorno"}
                      onClick={() => guardar({ tipoNegocio: t.valor })}
                      disabled={guardando}
                      aria-pressed={config.tipoNegocio === t.valor}
                    >
                      {t.etiqueta}
                    </Boton>
                  ))}
                </div>
                <p className="campo-ayuda">El tipo de equipo que Recibir equipo propone por defecto.</p>
              </Tarjeta>

              <ConfigFases />
            </>
          )}

          {pestana === "impresoras" && (
            <>
              <ImpresorasUsbEsteEquipo />
              <DescargaPuente />
            </>
          )}

          {mensaje && (
            <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
              {mensaje}
            </Aviso>
          )}
          <VentanaError mensaje={error} onCerrar={() => setError(null)} />
        </div>
      </div>
    </div>
  );
}

/** El hueco gris con un ícono de imagen cuando todavía no se ha subido nada. */
function CuadroVacio({ ancho }: { ancho: number }) {
  return (
    <div
      style={{
        height: 48,
        width: ancho,
        borderRadius: "var(--r-md)",
        background: "var(--surface-2)",
        color: "var(--ink-3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <ImagePlus size={22} strokeWidth={1.8} aria-hidden />
    </div>
  );
}
