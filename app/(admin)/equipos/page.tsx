"use client";

/**
 * Listado de equipos de clientes (`producto`): la patineta o el celular
 * que entra a reparación, no el inventario propio de la tienda (eso es
 * /inventario, tabla `articulo`). El serial es el mismo entre visitas --
 * esta pantalla es el directorio, el historial vive en cada orden.
 */
import { useEffect, useState } from "react";

interface Equipo {
  id: string;
  serial: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  cliente: { id: string; nombre: string } | null;
}

export default function PaginaEquipos() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) throw new Error(data.error ?? "No se pudieron cargar los equipos");
        setEquipos(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los equipos"));
  }, []);

  return (
    <div>
      <h1>Equipos</h1>
      {error && <p style={{ color: "#ff8080" }}>{error}</p>}
      {equipos.length === 0 && !error && <p style={{ opacity: 0.6 }}>Todavía no hay equipos registrados.</p>}

      {equipos.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
              <th style={{ padding: 8 }}>Serial</th>
              <th style={{ padding: 8 }}>Tipo</th>
              <th style={{ padding: 8 }}>Marca / Modelo</th>
              <th style={{ padding: 8 }}>Cliente</th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                <td style={{ padding: 8, fontFamily: "monospace" }}>{e.serial}</td>
                <td style={{ padding: 8 }}>{e.tipo}</td>
                <td style={{ padding: 8 }}>{[e.marca, e.modelo].filter(Boolean).join(" ") || "—"}</td>
                <td style={{ padding: 8 }}>{e.cliente?.nombre ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
