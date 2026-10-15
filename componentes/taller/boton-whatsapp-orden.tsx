"use client";

/**
 * "Enviar por WhatsApp" junto a "Copiar enlace": abre un diálogo con el
 * mensaje ya escrito (enlace de seguimiento incluido, según el estado
 * de la orden) y al enviar abre wa.me -- el mismo enfoque que
 * BotonWhatsappCliente en /clientes. El número lo elige el servidor
 * (GET /api/ordenes/[id]/whatsapp): el alternativo de la orden o, si no
 * hay, el del cliente. No se muestra en pantalla: el técnico no ve los
 * teléfonos del cliente (0003_vista_tecnico.sql).
 */
import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Aviso } from "@/componentes/ui/campo";
import { enlaceWhatsapp } from "@/lib/compras/whatsapp";
import type { DestinoWhatsapp } from "@/lib/orden-whatsapp";

interface DatosWhatsapp {
  numero: string;
  destino: DestinoWhatsapp;
  mensaje: string;
}

export function BotonWhatsappOrden({
  ordenId,
  tamano = "sm",
  variante = "fantasma",
  ancho,
  disabled,
  abrirAlMontar,
}: {
  ordenId: string;
  tamano?: "sm" | "md";
  variante?: "fantasma" | "contorno" | "primario";
  ancho?: boolean;
  disabled?: boolean;
  /** Abre el diálogo apenas aparece el botón (Recibir → "Enviar por WhatsApp"). */
  abrirAlMontar?: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [datos, setDatos] = useState<DatosWhatsapp | null>(null);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function abrir() {
    setCargando(true);
    setError(null);
    setDatos(null);
    dialogo.current?.showModal();
    try {
      const res = await fetch(`/api/ordenes/${ordenId}/whatsapp`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo preparar el mensaje");
      setDatos(data);
      setTexto(data.mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo preparar el mensaje");
    } finally {
      setCargando(false);
    }
  }

  // Solo el diálogo se abre solo; WhatsApp se abre con el toque en
  // "Abrir WhatsApp", así el celular no lo bloquea como ventana emergente.
  useEffect(() => {
    if (abrirAlMontar) abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enviar() {
    if (!datos) return;
    window.open(enlaceWhatsapp(datos.numero, texto), "_blank", "noopener");
    dialogo.current?.close();
  }

  return (
    <>
      <Boton
        variante={variante}
        tamano={tamano}
        ancho={ancho}
        icono={<MessageCircle size={tamano === "sm" ? 14 : 17} strokeWidth={2} />}
        onClick={abrir}
        disabled={disabled}
      >
        Enviar por WhatsApp
      </Boton>
      <dialog
        ref={dialogo}
        className="tarjeta tarjeta-relleno"
        style={{ width: "min(460px, calc(100vw - 32px))", border: "none", color: "inherit" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Enviar por WhatsApp</h2>
          <Boton variante="fantasma" tamano="sm" icono={<X size={16} />} onClick={() => dialogo.current?.close()} aria-label="Cerrar" />
        </div>
        {cargando && <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)" }}>Preparando el mensaje…</p>}
        {error && <Aviso tono="peligro">{error}</Aviso>}
        {datos && (
          <>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-3)" }}>
              {datos.destino === "alterno" ? "Va al número alternativo de contacto." : "Va al teléfono del cliente."}
            </p>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} style={{ width: "100%" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <Boton variante="fantasma" onClick={() => dialogo.current?.close()}>
                Cancelar
              </Boton>
              <Boton
                variante="primario"
                icono={<MessageCircle size={17} strokeWidth={2} />}
                onClick={enviar}
                disabled={!texto.trim()}
              >
                Abrir WhatsApp
              </Boton>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
