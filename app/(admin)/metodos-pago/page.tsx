"use client";

/**
 * Catálogo de métodos de pago de la empresa. Reemplaza los tres valores
 * fijos que antes vivían en un check constraint de la base -- ahora
 * cualquier empresa puede agregar Nequi, DaviPlata, Bre-B... y
 * activar/desactivar los que ya no use, sin tocar código.
 */
import { useEffect, useState } from "react";

interface Metodo {
  id: string;
  nombre: string;
  es_efectivo: boolean;
  activo: boolean;
}

export default function PaginaMetodosPago() {
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [nombre, setNombre] = useState("");
  const [esEfectivo, setEsEfectivo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const res = await fetch("/api/metodos-pago?todos=1");
    setMetodos(await res.json());
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear() {
    if (!nombre.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/metodos-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), esEfectivo }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNombre("");
      setEsEfectivo(false);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el método");
    }
  }

  async function alternarActivo(m: Metodo) {
    await fetch(`/api/metodos-pago/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !m.activo }),
    });
    await cargar();
  }

  if (cargando) return <p>Cargando…</p>;

  return (
    <div>
      <h1>Métodos de pago</h1>
      <p style={{ opacity: 0.6, fontSize: 14 }}>
        Solo el marcado como efectivo abre el cajón y cuenta en el cierre de caja.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th>Nombre</th>
            <th>Es efectivo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {metodos.map((m) => (
            <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{m.nombre}</td>
              <td>{m.es_efectivo ? "Sí" : "No"}</td>
              <td>{m.activo ? "Activo" : "Inactivo"}</td>
              <td>
                <button onClick={() => alternarActivo(m)}>{m.activo ? "Desactivar" : "Activar"}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16 }}>Agregar método</h2>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          placeholder="Ej. Nequi, DaviPlata, Bre-B…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={{ padding: 8 }}
        />
        <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" checked={esEfectivo} onChange={(e) => setEsEfectivo(e.target.checked)} />
          Es efectivo
        </label>
        <button onClick={crear} disabled={!nombre.trim()}>
          Agregar
        </button>
      </div>
      {error && <p style={{ color: "#ff8080" }}>{error}</p>}
    </div>
  );
}
