"use client";

/**
 * Listado de clientes de la empresa. Un cliente puede tener varios
 * equipos (tabla `producto`) y varias órdenes a lo largo del tiempo --
 * esta pantalla es solo el directorio; el historial vive en cada orden.
 */
import { useEffect, useState } from "react";

interface Cliente {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  correo: string | null;
}

export default function PaginaClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) throw new Error(data.error ?? "No se pudieron cargar los clientes");
        setClientes(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los clientes"));
  }, []);

  return (
    <div>
      <h1>Clientes</h1>
      {error && <p style={{ color: "#ff8080" }}>{error}</p>}
      {clientes.length === 0 && !error && <p style={{ opacity: 0.6 }}>Todavía no hay clientes.</p>}

      {clientes.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
              <th style={{ padding: 8 }}>Nombre</th>
              <th style={{ padding: 8 }}>Documento</th>
              <th style={{ padding: 8 }}>Teléfono</th>
              <th style={{ padding: 8 }}>Correo</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                <td style={{ padding: 8 }}>{c.nombre}</td>
                <td style={{ padding: 8 }}>{c.documento ?? "—"}</td>
                <td style={{ padding: 8 }}>{c.telefono ?? "—"}</td>
                <td style={{ padding: 8 }}>{c.correo ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
