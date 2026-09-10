"use client";

/**
 * Recepción de equipo: buscar o crear cliente, buscar o registrar el
 * equipo por serial, escribir el motivo, guardar. Al guardar,
 * POST /api/ordenes crea la orden e imprime comprobante + etiqueta.
 *
 * El requisito de la Fase 3 del plano es que esto tome menos de tres
 * minutos -- por eso busca cliente y equipo por un solo campo (documento,
 * serial) antes de pedir llenar nada más.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Cliente {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  correo: string | null;
}

interface Producto {
  id: string;
  serial: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
}

export default function PaginaRecibir() {
  const router = useRouter();

  const [documento, setDocumento] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [clienteNuevo, setClienteNuevo] = useState({ nombre: "", telefono: "", correo: "" });
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  const [serial, setSerial] = useState("");
  const [producto, setProducto] = useState<Producto | null>(null);
  const [productoNuevo, setProductoNuevo] = useState({ tipo: "patineta", marca: "", modelo: "" });
  const [buscandoProducto, setBuscandoProducto] = useState(false);

  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ numero: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buscarCliente() {
    if (!documento.trim()) return;
    setBuscandoCliente(true);
    const res = await fetch(`/api/clientes?documento=${encodeURIComponent(documento.trim())}`);
    const data = await res.json();
    setCliente(data);
    setBuscandoCliente(false);
  }

  async function buscarProducto() {
    if (!serial.trim()) return;
    setBuscandoProducto(true);
    const res = await fetch(`/api/productos?serial=${encodeURIComponent(serial.trim())}`);
    const data = await res.json();
    setProducto(data);
    setBuscandoProducto(false);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { motivo: motivo.trim() };

      if (cliente) body.clienteId = cliente.id;
      else {
        if (!clienteNuevo.nombre.trim()) throw new Error("Falta el nombre del cliente");
        body.clienteNuevo = { nombre: clienteNuevo.nombre.trim(), documento: documento.trim() || undefined, telefono: clienteNuevo.telefono || undefined, correo: clienteNuevo.correo || undefined };
      }

      if (producto) body.productoId = producto.id;
      else {
        if (!serial.trim()) throw new Error("Falta el serial del equipo");
        body.productoNuevo = { serial: serial.trim(), ...productoNuevo };
      }

      const res = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);

      const data = await res.json();
      setResultado({ numero: data.numero });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la recepción");
    } finally {
      setGuardando(false);
    }
  }

  function nuevaRecepcion() {
    setDocumento("");
    setCliente(null);
    setClienteNuevo({ nombre: "", telefono: "", correo: "" });
    setSerial("");
    setProducto(null);
    setProductoNuevo({ tipo: "patineta", marca: "", modelo: "" });
    setMotivo("");
    setResultado(null);
  }

  if (resultado) {
    return (
      <div>
        <h1>Orden #{resultado.numero} creada</h1>
        <p>El comprobante y la etiqueta se están imprimiendo en la estación de esta sede.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={nuevaRecepcion}>Recibir otro equipo</button>
          <button onClick={() => router.push("/ordenes")}>Ver tablero de órdenes</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Recibir equipo</h1>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16 }}>1. Cliente</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Documento"
            value={documento}
            onChange={(e) => {
              setDocumento(e.target.value);
              setCliente(null);
            }}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={buscarCliente} disabled={buscandoCliente}>
            Buscar
          </button>
        </div>

        {cliente ? (
          <p>
            ✓ {cliente.nombre} {cliente.telefono ? `· ${cliente.telefono}` : ""}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              placeholder="Nombre del cliente"
              value={clienteNuevo.nombre}
              onChange={(e) => setClienteNuevo((c) => ({ ...c, nombre: e.target.value }))}
              style={{ padding: 8 }}
            />
            <input
              placeholder="Teléfono"
              value={clienteNuevo.telefono}
              onChange={(e) => setClienteNuevo((c) => ({ ...c, telefono: e.target.value }))}
              style={{ padding: 8 }}
            />
          </div>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16 }}>2. Equipo</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Serial (vacío = equipo nuevo, se genera al guardar)"
            value={serial}
            onChange={(e) => {
              setSerial(e.target.value);
              setProducto(null);
            }}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={buscarProducto} disabled={buscandoProducto || !serial.trim()}>
            Buscar
          </button>
        </div>

        {producto ? (
          <p>
            ✓ {producto.marca} {producto.modelo} ({producto.tipo})
          </p>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={productoNuevo.tipo}
              onChange={(e) => setProductoNuevo((p) => ({ ...p, tipo: e.target.value }))}
              style={{ padding: 8 }}
            >
              <option value="patineta">Patineta</option>
              <option value="celular">Celular</option>
              <option value="computador">Computador</option>
            </select>
            <input
              placeholder="Marca"
              value={productoNuevo.marca}
              onChange={(e) => setProductoNuevo((p) => ({ ...p, marca: e.target.value }))}
              style={{ padding: 8, flex: 1 }}
            />
            <input
              placeholder="Modelo"
              value={productoNuevo.modelo}
              onChange={(e) => setProductoNuevo((p) => ({ ...p, modelo: e.target.value }))}
              style={{ padding: 8, flex: 1 }}
            />
          </div>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16 }}>3. Motivo</h2>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Por qué deja el equipo…"
          rows={3}
          style={{ width: "100%", padding: 8 }}
        />
      </section>

      <button disabled={guardando || !motivo.trim()} onClick={guardar} style={{ padding: "10px 20px" }}>
        {guardando ? "Guardando…" : "Recibir e imprimir"}
      </button>
      {error && <p style={{ color: "#c0392b" }}>{error}</p>}
    </div>
  );
}
