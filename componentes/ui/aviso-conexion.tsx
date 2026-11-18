"use client";

/**
 * Franja «Sin conexión» (plan sin internet, fase 0).
 *
 * Aparece abajo, en todas las pantallas, cuando el equipo pierde
 * internet (lib/sin-conexion/conexion.ts), y avisa una vez más cuando
 * vuelve. También cuenta lo guardado sin conexión que falta subir o que
 * quedó para revisar (lib/sin-conexion/cola.ts), con enlace a
 * /sincronizacion.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WifiOff, Wifi } from "lucide-react";
import { estadoConexion, intervaloPrueba, probarServidor, type EstadoConexion } from "@/lib/sin-conexion/conexion";
import { listarCola, suscribirCola } from "@/lib/sin-conexion/cola";

const DURACION_AVISO_VOLVIO_MS = 4000;

export function AvisoConexion() {
  const [estado, setEstado] = useState<EstadoConexion>("en_linea");
  const [volvio, setVolvio] = useState(false);
  const anterior = useRef<EstadoConexion>("en_linea");
  const [cola, setCola] = useState({ pendientes: 0, revisar: 0 });

  useEffect(() => {
    let vivo = true;
    const contar = () =>
      void listarCola().then((todos) => {
        if (vivo)
          setCola({
            pendientes: todos.filter((e) => e.estado === "pendiente").length,
            revisar: todos.filter((e) => e.estado !== "pendiente").length,
          });
      });
    contar();
    const quitar = suscribirCola(contar);
    return () => {
      vivo = false;
      quitar();
    };
  }, []);

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

  const hayCola = cola.pendientes > 0 || cola.revisar > 0;
  if (estado === "en_linea" && !volvio && !hayCola) return null;

  const sin = estado === "sin_conexion";
  const conAviso = sin || cola.revisar > 0;
  const plural = (n: number, una: string, varias: string) => `${n} ${n === 1 ? una : varias}`;
  const textoCola = [
    cola.pendientes > 0 && (sin ? plural(cola.pendientes, "venta guardada en este equipo", "ventas guardadas en este equipo") : `Subiendo ${plural(cola.pendientes, "venta guardada sin conexión", "ventas guardadas sin conexión")}…`),
    cola.revisar > 0 && plural(cola.revisar, "para revisar", "para revisar"),
  ]
    .filter(Boolean)
    .join(" · ");
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
        background: conAviso ? "var(--aviso-fondo)" : "var(--ok-fondo)",
        border: `1px solid ${conAviso ? "var(--aviso-linea)" : "var(--ok-linea)"}`,
        color: conAviso ? "var(--aviso)" : "var(--ok)",
        boxShadow: "var(--sombra-2)",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {sin ? <WifiOff size={18} aria-hidden /> : <Wifi size={18} aria-hidden />}
      <span style={{ flex: 1, minWidth: 0 }}>
        {sin ? "Sin conexión. Vender sigue funcionando y se sube solo cuando vuelva internet; lo demás necesita conexión." : volvio && !hayCola ? "Volvió la conexión." : null}
        {textoCola && <span style={{ display: "block" }}>{textoCola}</span>}
      </span>
      {hayCola && (
        <Link href="/sincronizacion" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline", whiteSpace: "nowrap" }}>
          Ver
        </Link>
      )}
    </div>
  );
}
