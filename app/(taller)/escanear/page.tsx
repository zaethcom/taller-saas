"use client";

/**
 * Escanear el QR de un equipo abre su orden activa -- la primera de
 * las dos promesas del proyecto.
 *
 * Usa BarcodeDetector, nativo de Chrome/Android -- sin librería
 * externa, sin peso extra en el bundle. Donde no existe (Safari/iOS
 * todavía no lo soporta ampliamente) el campo de serial manual sigue
 * siempre visible, no es un respaldo oculto. El ciclo de vida de la
 * cámara vive en componentes/lector-codigos/usar-lector-codigos.ts --
 * compartido con /recibir (código de barras del serial) y con
 * /entregar (QR de la etiqueta), no se repite acá.
 *
 * El QR impreso codifica la URL de seguimiento completa, no el serial
 * (ver app/api/ordenes/route.ts) -- así que decodificar el QR extrae
 * el token de esa URL y resuelve la orden con /api/ordenes/por-token.
 * Si lo que se lee no es esa URL (o si se escribe a mano), se busca
 * por serial con /api/ordenes/por-serial.
 *
 * El visor (cámara, esquinas, línea) es componentes/lector-codigos/
 * visor-escaner.tsx, el mismo de /entregar.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Search, Barcode } from "lucide-react";
import { VisorEscaner, SeparadorEscribelo } from "@/componentes/lector-codigos/visor-escaner";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { VentanaError } from "@/componentes/ui/ventana-error";

function extraerTokenDeSeguimiento(valor: string): string | null {
  try {
    const url = new URL(valor);
    const partes = url.pathname.split("/").filter(Boolean);
    const i = partes.indexOf("seguimiento");
    const token = i >= 0 ? partes[i + 1] : undefined;
    if (token) return token;
  } catch {
    // No era una URL -- se intenta como serial más abajo.
  }
  return null;
}

export default function PaginaEscanear() {
  const router = useRouter();
  const [serial, setSerial] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function procesarCodigo(valor: string) {
    const token = extraerTokenDeSeguimiento(valor);
    if (token) {
      buscarPorToken(token);
    } else {
      buscarPorSerial(valor.trim());
    }
  }

  async function buscarPorToken(token: string) {
    setBuscando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/por-token?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const { ordenId } = await res.json();
      router.push(`/orden/${ordenId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al buscar la orden");
      setBuscando(false);
    }
  }

  async function buscarPorSerial(valor: string) {
    setBuscando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/por-serial?serial=${encodeURIComponent(valor)}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const { ordenId } = await res.json();
      router.push(`/orden/${ordenId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al buscar la orden");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div>
      <TituloPantalla
        icono={<ScanLine size={24} strokeWidth={2} />}
        titulo="Escanear equipo"
        descripcion="Apunta al QR del equipo para abrir su ficha y sus órdenes."
      />

      <div className="pila">
        <VisorEscaner
          formats={["qr_code"]}
          onDetectado={procesarCodigo}
          buscando={buscando}
          textoSinCamara="Este navegador no lee QR con la cámara. Usa el campo de serial de abajo."
        />

        <SeparadorEscribelo />

        <Tarjeta>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (serial.trim()) buscarPorSerial(serial.trim());
            }}
          >
            <Campo etiqueta="Serial del equipo">
              <div className="fila" style={{ gap: 0, flexWrap: "nowrap" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 46,
                    height: 44,
                    borderRadius: "var(--r-md) 0 0 var(--r-md)",
                    border: "1px solid var(--rule-fuerte)",
                    borderRight: "none",
                    background: "var(--surface-2)",
                    color: "var(--ink-2)",
                    flexShrink: 0,
                  }}
                >
                  <Barcode size={20} strokeWidth={1.8} aria-hidden />
                </span>
                <input
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="Ej. RL-000001"
                  aria-label="Serial del equipo"
                  className="cifra"
                  style={{ borderRadius: "0 var(--r-md) var(--r-md) 0" }}
                />
              </div>
            </Campo>
            <div style={{ marginTop: 14 }}>
              <Boton
                type="submit"
                variante="primario"
                tamano="lg"
                ancho
                icono={<Search size={19} strokeWidth={2} />}
                disabled={buscando || !serial.trim()}
              >
                {buscando ? "Buscando…" : "Buscar orden"}
              </Boton>
            </div>
          </form>
        </Tarjeta>

        <VentanaError mensaje={error} onCerrar={() => setError(null)} />
      </div>
    </div>
  );
}
