"use client";

/**
 * Recepción de equipo: buscar o crear cliente, buscar o registrar el
 * equipo por serial, escribir el motivo, guardar. Al guardar,
 * POST /api/ordenes crea la orden e imprime comprobante + etiqueta.
 *
 * El requisito de la Fase 3 del plano es que esto tome menos de tres
 * minutos -- por eso busca cliente y equipo por un solo campo (documento,
 * serial) antes de pedir llenar nada más, y por eso los tres pasos son
 * tres tarjetas numeradas en una sola pantalla, sin asistente ni
 * pestañas: quien recibe ve de un vistazo lo que le falta.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Search, Check, User, Wrench, FileText, Printer, ClipboardList } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

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

/** El número del paso, para que las tres tarjetas se lean como una secuencia. */
function Paso({ n, titulo, icono, children }: { n: number; titulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <Tarjeta>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span
          className="cifra"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: "var(--r-sm)",
            background: "var(--accent)",
            color: "var(--accent-texto)",
            fontSize: 13,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {n}
        </span>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icono}
          {titulo}
        </h2>
      </div>
      {children}
    </Tarjeta>
  );
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
      <Tarjeta style={{ textAlign: "center", padding: 36 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 58,
            height: 58,
            borderRadius: "var(--r-lg)",
            background: "var(--ok-fondo)",
            color: "var(--ok)",
            marginBottom: 14,
          }}
        >
          <Check size={30} strokeWidth={2.4} />
        </span>
        <h1>
          Orden <span className="cifra">#{resultado.numero}</span> creada
        </h1>
        <p style={{ margin: "8px 0 20px", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Printer size={17} strokeWidth={2} aria-hidden />
          El comprobante y la etiqueta se están imprimiendo en la estación de esta sede.
        </p>
        <div className="fila" style={{ justifyContent: "center" }}>
          <Boton variante="primario" icono={<Inbox size={18} strokeWidth={2} />} onClick={nuevaRecepcion}>
            Recibir otro equipo
          </Boton>
          <Boton
            variante="contorno"
            icono={<ClipboardList size={18} strokeWidth={2} />}
            onClick={() => router.push("/ordenes")}
          >
            Ver tablero de órdenes
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  return (
    <div>
      <TituloPantalla
        icono={<Inbox size={24} strokeWidth={2} />}
        titulo="Recibir equipo"
        descripcion="Cliente, equipo y motivo. Al guardar se imprime el comprobante y la etiqueta."
      />

      <div className="pila">
        <Paso n={1} titulo="Cliente" icono={<User size={18} strokeWidth={2} color="var(--ink-2)" />}>
          <form
            className="fila"
            style={{ gap: 8, flexWrap: "nowrap", marginBottom: cliente ? 12 : 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              buscarCliente();
            }}
          >
            <input
              placeholder="Documento"
              value={documento}
              onChange={(e) => {
                setDocumento(e.target.value);
                setCliente(null);
              }}
              aria-label="Documento del cliente"
            />
            <Boton type="submit" variante="contorno" icono={<Search size={17} strokeWidth={2} />} disabled={buscandoCliente}>
              Buscar
            </Boton>
          </form>

          {cliente ? (
            <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
              <strong>{cliente.nombre}</strong>
              {cliente.telefono ? <span className="cifra"> · {cliente.telefono}</span> : ""}
            </Aviso>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Campo etiqueta="Nombre del cliente">
                <input
                  placeholder="Nombre y apellido"
                  value={clienteNuevo.nombre}
                  onChange={(e) => setClienteNuevo((c) => ({ ...c, nombre: e.target.value }))}
                />
              </Campo>
              <Campo etiqueta="Teléfono" ayuda="Por ahí se le avisa cuando el equipo esté listo.">
                <input
                  placeholder="300 000 0000"
                  value={clienteNuevo.telefono}
                  onChange={(e) => setClienteNuevo((c) => ({ ...c, telefono: e.target.value }))}
                />
              </Campo>
            </div>
          )}
        </Paso>

        <Paso n={2} titulo="Equipo" icono={<Wrench size={18} strokeWidth={2} color="var(--ink-2)" />}>
          <form
            className="fila"
            style={{ gap: 8, flexWrap: "nowrap", marginBottom: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              buscarProducto();
            }}
          >
            <input
              placeholder="Serial (vacío = equipo nuevo, se genera al guardar)"
              value={serial}
              onChange={(e) => {
                setSerial(e.target.value);
                setProducto(null);
              }}
              aria-label="Serial del equipo"
            />
            <Boton
              type="submit"
              variante="contorno"
              icono={<Search size={17} strokeWidth={2} />}
              disabled={buscandoProducto || !serial.trim()}
            >
              Buscar
            </Boton>
          </form>

          {producto ? (
            <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
              <strong>
                {producto.marca} {producto.modelo}
              </strong>{" "}
              ({producto.tipo})
            </Aviso>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "160px repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <Campo etiqueta="Tipo">
                <select
                  value={productoNuevo.tipo}
                  onChange={(e) => setProductoNuevo((p) => ({ ...p, tipo: e.target.value }))}
                >
                  <option value="patineta">Patineta</option>
                  <option value="celular">Celular</option>
                  <option value="computador">Computador</option>
                </select>
              </Campo>
              <Campo etiqueta="Marca">
                <input
                  placeholder="Marca"
                  value={productoNuevo.marca}
                  onChange={(e) => setProductoNuevo((p) => ({ ...p, marca: e.target.value }))}
                />
              </Campo>
              <Campo etiqueta="Modelo">
                <input
                  placeholder="Modelo"
                  value={productoNuevo.modelo}
                  onChange={(e) => setProductoNuevo((p) => ({ ...p, modelo: e.target.value }))}
                />
              </Campo>
            </div>
          )}
        </Paso>

        <Paso n={3} titulo="Motivo" icono={<FileText size={18} strokeWidth={2} color="var(--ink-2)" />}>
          <Campo ayuda="Lo que el cliente reporta, con sus palabras. Es lo que lee el técnico al abrir la orden.">
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué deja el equipo…"
              rows={3}
              aria-label="Motivo de la recepción"
            />
          </Campo>
        </Paso>

        <div className="fila">
          <Boton
            variante="primario"
            tamano="lg"
            icono={<Printer size={19} strokeWidth={2} />}
            disabled={guardando || !motivo.trim()}
            onClick={guardar}
          >
            {guardando ? "Guardando…" : "Recibir e imprimir"}
          </Boton>
          {!motivo.trim() && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Falta el motivo para poder guardar.</span>}
        </div>

        {error && <Aviso tono="peligro">{error}</Aviso>}
      </div>
    </div>
  );
}
