"use client";

/**
 * Botón de WhatsApp por cliente en el directorio (/clientes). Abre un
 * diálogo con un saludo ya escrito que se puede editar, y al enviar
 * abre wa.me en otra pestaña -- el mismo enfoque que /compras: sin
 * backend ni cuenta de negocio de Meta, la persona envía desde su
 * WhatsApp.
 */
import { useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { enlaceWhatsapp } from "@/lib/compras/whatsapp";
import { mensajeInicialCliente, numeroWhatsappCliente } from "@/lib/clientes/whatsapp";

export function BotonWhatsappCliente({ nombre, telefono }: { nombre: string; telefono: string | null }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [texto, setTexto] = useState("");
  const numero = numeroWhatsappCliente(telefono);

  if (!numero) return null;

  function abrir() {
    setTexto(mensajeInicialCliente(nombre));
    dialogo.current?.showModal();
  }

  function enviar() {
    window.open(enlaceWhatsapp(numero!, texto), "_blank", "noopener");
    dialogo.current?.close();
  }

  return (
    <>
      <Boton
        variante="contorno"
        tamano="sm"
        icono={<MessageCircle size={15} strokeWidth={2} />}
        onClick={abrir}
        title={`Enviar WhatsApp a ${nombre}`}
      >
        WhatsApp
      </Boton>
      <dialog
        ref={dialogo}
        className="tarjeta tarjeta-relleno"
        style={{ width: "min(440px, calc(100vw - 32px))", border: "none", color: "inherit" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>WhatsApp a {nombre}</h2>
          <Boton variante="fantasma" tamano="sm" icono={<X size={16} />} onClick={() => dialogo.current?.close()} aria-label="Cerrar" />
        </div>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-3)" }} className="cifra">
          +{numero}
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          autoFocus
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <Boton variante="fantasma" onClick={() => dialogo.current?.close()}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono={<MessageCircle size={17} strokeWidth={2} />} onClick={enviar}>
            Abrir WhatsApp
          </Boton>
        </div>
      </dialog>
    </>
  );
}
