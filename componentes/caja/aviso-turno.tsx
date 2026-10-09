"use client";

/**
 * Bloquea /vender y /entregar cuando no hay turno de caja abierto --
 * /api/ventas ya rechaza el cobro con un 409 en ese caso, pero antes
 * de esto el único indicio era ese error al intentar cobrar. Devuelve
 * si hay turno abierto, para que la pantalla decida qué deshabilitar.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Aviso } from "@/componentes/ui/campo";

export function useTurnoAbierto(): boolean | null {
  const [abierto, setAbierto] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/turno/actual")
      .then((r) => r.json())
      .then((data) => setAbierto(Boolean(data.abierto)))
      .catch(() => setAbierto(null));
  }, []);

  return abierto;
}

export function AvisoTurnoCerrado() {
  return (
    <Aviso tono="peligro" icono={<AlertTriangle size={17} strokeWidth={2} />}>
      No hay un turno de caja abierto en esta sede.{" "}
      <Link href="/turno" style={{ color: "inherit", textDecoration: "underline" }}>
        Abrir turno
      </Link>
    </Aviso>
  );
}
