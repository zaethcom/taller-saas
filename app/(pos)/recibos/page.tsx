"use client";

/**
 * Los cinco últimos recibos de venta de la sede activa, para verlos o
 * reimprimirlos. Va en el menú del POS justo debajo de Vender: es lo
 * que se busca cuando el cliente vuelve por el papel, y no ocupa
 * espacio en la pantalla de cobro.
 */

import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { UltimosRecibos } from "@/componentes/cobro/ultimos-recibos";

export default function PaginaRecibos() {
  return (
    <div style={{ maxWidth: 640 }}>
      <TituloPantalla
        titulo="Recibos"
      />
      <UltimosRecibos />
    </div>
  );
}
