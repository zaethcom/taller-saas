"use client";

/**
 * Personalizar el recibo de una sede en particular -- dirección,
 * teléfono, pie y logo. Cualquier campo que se deje vacío cae al valor
 * general de /configuracion; esto es solo para cuando una sede
 * necesita mostrar algo distinto (dos locales físicos con direcciones
 * o teléfonos distintos, o un logo propio).
 */
import { useEffect, useRef, useState } from "react";
import { Palette, Check, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { subirLogoSede } from "@/lib/subir-logo";

interface MarcaSede {
  logoUrl: string | null;
  reciboDireccion: string | null;
  reciboTelefono: string | null;
  reciboPie: string | null;
}

const VACIA: MarcaSede = { logoUrl: null, reciboDireccion: null, reciboTelefono: null, reciboPie: null };

export function ConfigMarca({ sedeId, empresaId }: { sedeId: string; empresaId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [marca, setMarca] = useState<MarcaSede>(VACIA);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputLogoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    fetch(`/api/sedes/${sedeId}/marca`)
      .then((r) => r.json())
      .then((data: MarcaSede | null) => setMarca(data ?? VACIA))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [abierto, sedeId]);

  async function guardar(cambios: Partial<MarcaSede> = {}) {
    const nueva = { ...marca, ...cambios };
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(`/api/sedes/${sedeId}/marca`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nueva),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMarca(nueva);
      setMensaje("Guardado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarLogo(archivo: File) {
    setError(null);
    setSubiendoLogo(true);
    try {
      const url = await subirLogoSede(empresaId, sedeId, archivo);
      await guardar({ logoUrl: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el logo");
    } finally {
      setSubiendoLogo(false);
    }
  }

  if (!abierto) {
    return (
      <Boton
        variante="fantasma"
        tamano="sm"
        icono={<Palette size={14} strokeWidth={2} />}
        onClick={() => setAbierto(true)}
        style={{ marginTop: 10 }}
      >
        Personalizar recibo
      </Boton>
    );
  }

  return (
    <Tarjeta style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <Palette size={16} strokeWidth={2} />
          Recibo de esta sede
        </div>
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={<X size={15} strokeWidth={2} />}
          onClick={() => setAbierto(false)}
        />
      </div>

      {cargando ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Cargando…</p>
      ) : (
        <>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--ink-3)" }}>
            Vacío = usa lo de Configuración general. Completar solo lo que esta sede necesita distinto (por
            ejemplo, su propia dirección o un logo propio).
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            {marca.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- viene de Storage, no del proyecto.
              <img
                src={marca.logoUrl}
                alt="Logo de esta sede"
                style={{ width: 52, height: 52, objectFit: "contain", borderRadius: "var(--r-md)", background: "var(--surface-2)" }}
              />
            ) : (
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "var(--r-md)",
                  background: "var(--surface-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  textAlign: "center",
                }}
              >
                sin logo propio
              </div>
            )}
            <Boton
              variante="contorno"
              tamano="sm"
              onClick={() => inputLogoRef.current?.click()}
              disabled={subiendoLogo}
            >
              {subiendoLogo ? "Subiendo…" : marca.logoUrl ? "Cambiar logo" : "Subir logo propio"}
            </Boton>
            <input
              ref={inputLogoRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                e.target.value = "";
                if (archivo) cambiarLogo(archivo);
              }}
              disabled={subiendoLogo}
              aria-label="Logo propio de esta sede"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <Campo etiqueta="Dirección">
              <input
                placeholder="(usa la de Configuración general)"
                value={marca.reciboDireccion ?? ""}
                onChange={(e) => setMarca({ ...marca, reciboDireccion: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Teléfono">
              <input
                placeholder="(usa el de Configuración general)"
                value={marca.reciboTelefono ?? ""}
                onChange={(e) => setMarca({ ...marca, reciboTelefono: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Pie del recibo (eslogan, mensaje de despedida)">
              <input
                placeholder="(usa el de Configuración general)"
                value={marca.reciboPie ?? ""}
                onChange={(e) => setMarca({ ...marca, reciboPie: e.target.value })}
              />
            </Campo>
          </div>

          <div style={{ marginTop: 14 }}>
            <Boton
              variante="primario"
              tamano="sm"
              icono={<Check size={15} strokeWidth={2.2} />}
              onClick={() => guardar()}
              disabled={guardando}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
          </div>
        </>
      )}

      {mensaje && (
        <div style={{ marginTop: 10 }}>
          <Aviso tono="ok">{mensaje}</Aviso>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 10 }}>
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}
    </Tarjeta>
  );
}
