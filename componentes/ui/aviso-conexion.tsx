"use client";

/**
 * Franja «Sin conexión» (plan sin internet, fase 0).
 *
 * Aparece abajo, en todas las pantallas, cuando el equipo pierde
 * internet (lib/sin-conexion/conexion.ts), y avisa una vez más cuando
 * vuelve. Por ahora solo informa: guardar, cobrar o recibir todavía
 * necesitan conexión. Las fases siguientes del plan hacen que esas
 * acciones queden guardadas en el equipo y se suban solas.
 */
import { useEffect, useRef, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { estadoConexion, intervaloPrueba, probarServidor, type EstadoConexion } from "@/lib/sin-conexion/conexion";

const DURACION_AVISO_VOLVIO_MS = 4000;

export function AvisoConexion() {
  const [estado, setEstado] = useState<EstadoConexion>("en_linea");
  const [volvio, setVolvio] = useState(false);
  const anterior = useRef<EstadoConexion>("en_linea");

  useEffect(() => {
    let cancelado = false;
    let reloj: ReturnType<typeof setTimeout> | undefined;

    async function revisar() {
      clearTimeout(reloj);
      const navegador = navigator.onLine;
      const prueba = navegador ? await probarServidor() : null;
      if (cancelado) return;
      const nuevo = estadoConexion(navegador, prueba);
      if (anterior.current === "sin_conexion" && nuevo === "en_linea") {
        setVolvio(true);
        setTimeout(() => !cancelado && setVolvio(false), DURACION_AVISO_VOLVIO_MS);
      }
      anterior.current = nuevo;
      setEstado(nuevo);
      reloj = setTimeout(revisar, intervaloPrueba(nuevo));
    }

    const ahora = () => void revisar();
    window.addEventListener("online", ahora);
    window.addEventListener("offline", ahora);
    // Al volver a la pestaña (o despertar el equipo) se revisa enseguida.
    document.addEventListener("visibilitychange", ahora);
    void revisar();

    return () => {
      cancelado = true;
      clearTimeout(reloj);
      window.removeEventListener("online", ahora);
      window.removeEventListener("offline", ahora);
      document.removeEventListener("visibilitychange", ahora);
    };
  }, []);

  if (estado === "en_linea" && !volvio) return null;

  const sin = estado === "sin_conexion";
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        gap: 10,
        maxWidth: 560,
        margin: "0 auto",
        padding: "10px 14px",
        borderRadius: "var(--r-md)",
        background: sin ? "var(--aviso-fondo)" : "var(--ok-fondo)",
        border: `1px solid ${sin ? "var(--aviso-linea)" : "var(--ok-linea)"}`,
        color: sin ? "var(--aviso)" : "var(--ok)",
        boxShadow: "var(--sombra-2)",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {sin ? <WifiOff size={18} aria-hidden /> : <Wifi size={18} aria-hidden />}
      <span>
        {sin
          ? "Sin conexión a internet. Lo que guardes ahora puede no quedar registrado; espera a que vuelva."
          : "Volvió la conexión."}
      </span>
    </div>
  );
}
