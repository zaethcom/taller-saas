"use client";

/**
 * "Copiar enlace" y "Enviar por WhatsApp" del seguimiento de la orden,
 * juntos y en rejilla: en pantallas angostas quedan uno debajo del
 * otro, a todo el ancho. Los usan CabeceraOrden (pantallas de etapa),
 * la ficha de la orden (/orden/[id]) y el final de /recibir.
 */
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { BotonWhatsappOrden } from "@/componentes/taller/boton-whatsapp-orden";

export function EnlaceOrden({
  ordenId,
  tokenPublico,
  conWhatsapp = true,
  abrirWhatsapp,
  tamano = "sm",
}: {
  ordenId: string;
  /** Sin token (la orden aún carga) los botones quedan deshabilitados. */
  tokenPublico?: string | null;
  conWhatsapp?: boolean;
  /** Abre el diálogo de WhatsApp apenas se muestra (al recibir con "Enviar por WhatsApp"). */
  abrirWhatsapp?: boolean;
  tamano?: "sm" | "md";
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiarEnlace() {
    if (!tokenPublico) return;
    await navigator.clipboard.writeText(`${window.location.origin}/seguimiento/${tokenPublico}`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
      <Boton
        variante="contorno"
        tamano={tamano}
        ancho
        icono={copiado ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}
        onClick={copiarEnlace}
        disabled={!tokenPublico}
      >
        {copiado ? "Copiado" : "Copiar enlace"}
      </Boton>
      {conWhatsapp && (
        <BotonWhatsappOrden
          ordenId={ordenId}
          tamano={tamano}
          variante="contorno"
          ancho
          disabled={!tokenPublico}
          abrirAlMontar={abrirWhatsapp}
        />
      )}
    </div>
  );
}
