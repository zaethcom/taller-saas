"use client";

/**
 * A quién se le vende, en el carrito de /vender. Es opcional: sin
 * tocar nada la venta queda a "Consumidor final", como siempre. Quien
 * cobra escribe nombre, documento o teléfono; si el cliente ya existe
 * se elige de la lista, y si no, se llenan sus datos ahí mismo y el
 * cliente se crea junto con la venta (POST /api/ventas, clienteNuevo):
 * no queda un cliente suelto si al final no se cobra.
 */
import { useEffect, useRef, useState } from "react";
import { UserRound, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { pareceCelular, sePuedeBuscarCliente, type ClienteEncontrado } from "@/lib/busqueda-cliente";

export interface ClienteVenta {
  /** null: cliente nuevo, se crea al cobrar. */
  id: string | null;
  nombre: string;
  documento: string | null;
  telefono: string | null;
}

/** Lo que se manda a POST /api/ventas por el cliente elegido. */
export function clienteEnVenta(c: ClienteVenta | null) {
  if (!c) return {};
  if (c.id) return { clienteId: c.id };
  return { clienteNuevo: { nombre: c.nombre, documento: c.documento, telefono: c.telefono } };
}

const sePuedeBuscar = (texto: string) =>
  sePuedeBuscarCliente(texto) || texto.replace(/[^\p{L}]/gu, "").length >= 3;

export function ClienteVentaSelector({
  valor,
  onCambiar,
}: {
  valor: ClienteVenta | null;
  onCambiar: (c: ClienteVenta | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<ClienteEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState("");
  const [nuevo, setNuevo] = useState({ nombre: "", documento: "", telefono: "" });
  const [creando, setCreando] = useState(false);
  const turno = useRef(0);

  useEffect(() => {
    const valorBuscado = texto.trim();
    if (!abierto || !sePuedeBuscar(valorBuscado)) {
      turno.current++;
      setOpciones([]);
      setBuscado("");
      return;
    }
    const miTurno = ++turno.current;
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(`/api/clientes?nombre=1&q=${encodeURIComponent(valorBuscado)}`);
        const data: { clientes?: ClienteEncontrado[] } = res.ok ? await res.json() : {};
        if (miTurno !== turno.current) return;
        setOpciones(data.clientes ?? []);
        setBuscado(valorBuscado);
      } catch {
        // Sin red: se puede seguir con un cliente nuevo.
      } finally {
        if (miTurno === turno.current) setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [texto, abierto]);

  function cerrar() {
    turno.current++;
    setAbierto(false);
    setTexto("");
    setOpciones([]);
    setBuscado("");
    setBuscando(false);
    setCreando(false);
    setNuevo({ nombre: "", documento: "", telefono: "" });
  }

  function elegir(c: ClienteVenta) {
    onCambiar(c);
    cerrar();
  }

  /**
   * Lo que se escribió en el buscador pasa al campo que le corresponde
   * del cliente nuevo: letras al nombre, un celular al teléfono y otro
   * número al documento -- para no tener que escribirlo dos veces.
   */
  function empezarNuevo() {
    const t = texto.trim();
    setCreando(true);
    if (!t) setNuevo({ nombre: "", documento: "", telefono: "" });
    else if (/\p{L}/u.test(t) && !/\d/.test(t)) setNuevo({ nombre: t, documento: "", telefono: "" });
    else if (pareceCelular(t)) setNuevo({ nombre: "", documento: "", telefono: t });
    else setNuevo({ nombre: "", documento: t, telefono: "" });
  }

  if (valor) {
    return (
      <div className="cliente-venta">
        <UserRound size={17} strokeWidth={2} color="var(--accent)" aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {valor.nombre}
            {!valor.id && <span style={{ fontWeight: 500, color: "var(--ink-3)" }}> · nuevo</span>}
          </div>
          {(valor.documento || valor.telefono) && (
            <div className="cifra" style={{ fontSize: 11, color: "var(--ink-3)" }}>
              {[valor.documento, valor.telefono].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={<X size={15} strokeWidth={2} />}
          onClick={() => onCambiar(null)}
          aria-label="Quitar el cliente de la venta"
          title="Volver a consumidor final"
        />
      </div>
    );
  }

  if (!abierto) {
    return (
      <div className="cliente-venta">
        <UserRound size={17} strokeWidth={2} color="var(--ink-3)" aria-hidden />
        <span style={{ flex: 1, fontSize: 13, color: "var(--ink-2)" }}>Consumidor final</span>
        <Boton variante="contorno" tamano="sm" onClick={() => setAbierto(true)}>
          Agregar cliente
        </Boton>
      </div>
    );
  }

  const sinResultados = buscado !== "" && buscado === texto.trim() && !buscando && opciones.length === 0;
  const nombreNuevo = nuevo.nombre.trim();

  return (
    <div className="pila" style={{ gap: 8, padding: 10, border: "1px solid var(--rule)", borderRadius: "var(--r-md)" }}>
      <div className="fila" style={{ gap: 8, flexWrap: "nowrap" }}>
        <input
          autoFocus
          placeholder="Nombre, documento o teléfono"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar cliente por nombre, documento o teléfono"
        />
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={<X size={15} strokeWidth={2} />}
          onClick={cerrar}
          aria-label="Cancelar, dejar consumidor final"
        />
      </div>

      {buscando && <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Buscando…</div>}

      {opciones.length > 0 && !creando && (
        <div className="pila" style={{ gap: 6 }}>
          {opciones.map((c) => (
            <Boton
              key={c.id}
              type="button"
              variante="contorno"
              ancho
              onClick={() => elegir({ id: c.id, nombre: c.nombre, documento: c.documento, telefono: c.telefono })}
            >
              {c.nombre}
              {c.documento ? ` · ${c.documento}` : ""}
              {c.telefono ? ` · ${c.telefono}` : ""}
            </Boton>
          ))}
        </div>
      )}

      {creando ? (
        <form
          className="pila"
          style={{ gap: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombreNuevo) return;
            elegir({
              id: null,
              nombre: nombreNuevo,
              documento: nuevo.documento.trim() || null,
              telefono: nuevo.telefono.trim() || null,
            });
          }}
        >
          <div style={{ fontSize: 12, color: "var(--ink-2)" }}>Cliente nuevo: se guarda al cobrar.</div>
          <input
            autoFocus
            placeholder="Nombre"
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            aria-label="Nombre del cliente nuevo"
            required
          />
          <input
            placeholder="Documento (opcional)"
            value={nuevo.documento}
            onChange={(e) => setNuevo({ ...nuevo, documento: e.target.value })}
            aria-label="Documento del cliente nuevo"
          />
          <input
            placeholder="Teléfono (opcional)"
            inputMode="tel"
            value={nuevo.telefono}
            onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })}
            aria-label="Teléfono del cliente nuevo"
          />
          <Boton type="submit" variante="primario" tamano="sm" disabled={!nombreNuevo}>
            Usar este cliente
          </Boton>
        </form>
      ) : (
        <Boton type="button" variante="fantasma" tamano="sm" onClick={empezarNuevo}>
          {sinResultados ? "No está registrado: crear cliente nuevo" : opciones.length > 0 ? "Es un cliente nuevo" : "Crear cliente nuevo"}
        </Boton>
      )}
    </div>
  );
}
