"use client";

/**
 * Recepción de equipo: buscar o crear cliente, buscar o registrar el
 * equipo por serial, escribir el motivo, guardar. Al guardar,
 * POST /api/ordenes crea la orden e imprime comprobante + etiqueta.
 * "Enviar por WhatsApp", al lado, hace lo mismo y además abre el
 * mensaje con el enlace de seguimiento para el cliente.
 *
 * El requisito de la Fase 3 del plano es que esto tome menos de tres
 * minutos -- por eso busca cliente y equipo por un solo campo (documento,
 * serial) antes de pedir llenar nada más, y por eso los tres pasos son
 * tres tarjetas numeradas en una sola pantalla, sin asistente ni
 * pestañas: quien recibe ve de un vistazo lo que le falta.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Search, Check, User, Wrench, FileText, Printer, ClipboardList, Barcode, KeyRound, Camera, Wallet, ShoppingBag, MessageCircle } from "lucide-react";
import { LectorCodigoBarras } from "@/componentes/lector-codigos/lector-codigo-barras";
import { PatronGrid } from "@/componentes/patron-android/patron-grid";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { PanelCobro, formatearMoneda } from "@/componentes/cobro/panel-cobro";
import { useTurnoAbierto, AvisoTurnoCerrado } from "@/componentes/caja/aviso-turno";
import { EvidenciaIngreso, subirEvidenciaIngreso, type ArchivoIngreso } from "@/componentes/recepcion/evidencia-ingreso";
import { RepuestosNecesarios, type RepuestoElegido } from "@/componentes/recepcion/repuestos-necesarios";
import { EnlaceOrden } from "@/componentes/taller/enlace-orden";
import type { MarcaConModelos } from "@/lib/modelos-equipo";

type TipoNegocio = "celular" | "computador" | "patineta" | "otro";

/** El tipo de equipo que cada negocio ve primero al recibir -- ver /configuracion. */
const TIPO_POR_NEGOCIO: Record<TipoNegocio, string> = {
  celular: "celular",
  computador: "computador",
  patineta: "patineta",
  otro: "patineta",
};

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

interface Metodo {
  id: string;
  nombre: string;
  es_efectivo: boolean;
}

/** Valor del desplegable para escribir una marca o un modelo que no está en la lista. */
const OTRA = "__otra__";

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

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [evidencia, setEvidencia] = useState<ArchivoIngreso[]>([]);
  const [errorEvidencia, setErrorEvidencia] = useState<string | null>(null);

  const [documento, setDocumento] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [clienteNuevo, setClienteNuevo] = useState({ nombre: "", telefono: "", correo: "" });
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  // Número alternativo de contacto (0054_orden_telefono_alterno.sql): el
  // cliente de un taller de celulares deja su teléfono, así que por ahí
  // no contesta. "Enviar por WhatsApp" de la orden escribe a este número.
  const [telefonoAlterno, setTelefonoAlterno] = useState("");
  const [tipoNegocio, setTipoNegocio] = useState<TipoNegocio | null>(null);

  const [serial, setSerial] = useState("");
  const [producto, setProducto] = useState<Producto | null>(null);
  const [productoNuevo, setProductoNuevo] = useState({ tipo: "patineta", marca: "", modelo: "" });
  const [buscandoProducto, setBuscandoProducto] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  // Marcas y modelos del catálogo y de equipos ya recibidos; si no hay
  // ninguno, marca y modelo quedan como texto libre.
  const [marcas, setMarcas] = useState<MarcaConModelos[]>([]);
  const [marcaOtra, setMarcaOtra] = useState(false);
  const [modeloOtro, setModeloOtro] = useState(false);
  // Se pide para empresas de celulares o cuando el equipo es un celular;
  // en ese caso es obligatorio.
  const pideTelefonoAlterno =
    tipoNegocio === "celular" || (producto ? producto.tipo === "celular" : productoNuevo.tipo === "celular");
  const modelosDeMarca = marcaOtra ? [] : (marcas.find((m) => m.marca === productoNuevo.marca)?.modelos ?? []);

  const [tipoAcceso, setTipoAcceso] = useState<"" | "pin3" | "pin4" | "pin6" | "patron" | "otro">("");
  const [pinAcceso, setPinAcceso] = useState("");
  const [patronAcceso, setPatronAcceso] = useState<number[]>([]);
  const [otroAcceso, setOtroAcceso] = useState("");
  const [notaAcceso, setNotaAcceso] = useState("");

  const [motivo, setMotivo] = useState("");
  const [infoAdicional, setInfoAdicional] = useState("");
  const [repuestos, setRepuestos] = useState<RepuestoElegido[]>([]);
  // Valor del servicio y abono (lib/abono.ts): el abono entra a la caja
  // como venta de la orden y descuenta el saldo que se cobra al entregar.
  const [valorServicio, setValorServicio] = useState(0);
  const [abono, setAbono] = useState(0);
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [metodoPagoId, setMetodoPagoId] = useState("");
  const [montoRecibido, setMontoRecibido] = useState(0);
  const turnoAbierto = useTurnoAbierto();
  const metodo = metodos.find((m) => m.id === metodoPagoId);
  const saldo = Math.max(0, valorServicio - abono);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{
    ordenId: string;
    numero: number;
    tokenPublico: string;
    /** Se guardó con "Enviar por WhatsApp": el diálogo se abre solo. */
    enviarWhatsapp: boolean;
    serialGenerado?: string;
    evidenciaFallida: number;
    valorServicio: number;
    abono: number;
    abonoFallido: boolean;
    faltantesCompras: string[];
    faltantesFallidos: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El tipo que la empresa configuró en /configuracion (ver
  // tipo_negocio en empresa_config) decide qué aparece preseleccionado
  // acá -- antes era siempre "patineta" sin importar el negocio.
  useEffect(() => {
    fetch("/api/perfil")
      .then((r) => r.json())
      .then((p: { empresaId?: string }) => setEmpresaId(p.empresaId ?? null))
      .catch(() => {});
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((config: { tipoNegocio?: TipoNegocio | null }) => {
        if (config.tipoNegocio) {
          setTipoNegocio(config.tipoNegocio);
          setProductoNuevo((p) => ({ ...p, tipo: TIPO_POR_NEGOCIO[config.tipoNegocio as TipoNegocio] }));
        }
      })
      .catch(() => {});
    fetch("/api/metodos-pago")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setMetodos(data);
        if (data[0]) setMetodoPagoId(data[0].id);
      })
      .catch(() => {});
    fetch("/api/productos/modelos")
      .then((r) => (r.ok ? r.json() : { marcas: [] }))
      .then((d: { marcas?: MarcaConModelos[] }) => setMarcas(d.marcas ?? []))
      .catch(() => {});
  }, []);

  async function buscarCliente() {
    if (!documento.trim()) return;
    setBuscandoCliente(true);
    const res = await fetch(`/api/clientes?documento=${encodeURIComponent(documento.trim())}`);
    const data = await res.json();
    setCliente(data);
    setBuscandoCliente(false);
  }

  async function buscarProducto(valorSerial?: string) {
    const valor = (valorSerial ?? serial).trim();
    if (!valor) return;
    setBuscandoProducto(true);
    const res = await fetch(`/api/productos?serial=${encodeURIComponent(valor)}`);
    const data = await res.json();
    setProducto(data);
    setBuscandoProducto(false);
  }

  async function guardar(enviarWhatsapp = false) {
    setGuardando(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        motivo: motivo.trim(),
        infoAdicional: infoAdicional.trim() || undefined,
        valorServicio: valorServicio || undefined,
        telefonoAlterno: telefonoAlterno.trim() || undefined,
        repuestos: repuestos.length
          ? repuestos.map((r) => ({ repuestoId: r.repuestoId, descripcion: r.descripcion, cantidad: r.cantidad }))
          : undefined,
      };
      if (pideTelefonoAlterno && telefonoAlterno.replace(/\D/g, "").length < 7) {
        throw new Error("Falta el número alternativo de contacto");
      }
      if (abono > 0) {
        body.abono = {
          monto: abono,
          metodoPagoId,
          montoRecibido: metodo?.es_efectivo ? montoRecibido : undefined,
        };
      }

      if (tipoAcceso) {
        const valor =
          tipoAcceso === "patron" ? patronAcceso.join("-") : tipoAcceso === "otro" ? otroAcceso.trim() : pinAcceso.trim();
        if (valor) {
          body.acceso = { tipo: tipoAcceso, valor, nota: notaAcceso.trim() || undefined };
        }
      }

      if (cliente) body.clienteId = cliente.id;
      else {
        if (!clienteNuevo.nombre.trim()) throw new Error("Falta el nombre del cliente");
        body.clienteNuevo = { nombre: clienteNuevo.nombre.trim(), documento: documento.trim() || undefined, telefono: clienteNuevo.telefono || undefined, correo: clienteNuevo.correo || undefined };
      }

      if (producto) body.productoId = producto.id;
      else {
        // Sin serial, el servidor genera uno (EQ-XXXXXX) y lo devuelve.
        body.productoNuevo = { serial: serial.trim() || undefined, ...productoNuevo };
      }

      const res = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);

      const data = await res.json();
      // La evidencia del mostrador se sube después de crear la orden
      // (la ruta en Storage lleva el id de la orden). Si algo falla, la
      // orden igual queda creada y se avisa abajo.
      const evidenciaFallida = empresaId
        ? await subirEvidenciaIngreso({ empresaId, ordenId: data.ordenId, archivos: evidencia })
        : evidencia.length;
      setResultado({
        ordenId: data.ordenId,
        numero: data.numero,
        tokenPublico: data.tokenPublico,
        enviarWhatsapp,
        serialGenerado: data.serialGenerado,
        evidenciaFallida,
        valorServicio,
        abono: data.abonoFallido ? 0 : abono,
        abonoFallido: Boolean(data.abonoFallido),
        faltantesCompras: Array.isArray(data.faltantesCompras) ? data.faltantesCompras : [],
        faltantesFallidos: Boolean(data.faltantesFallidos),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la recepción");
    } finally {
      setGuardando(false);
    }
  }

  function nuevaRecepcion() {
    evidencia.forEach((a) => URL.revokeObjectURL(a.url));
    setEvidencia([]);
    setErrorEvidencia(null);
    setDocumento("");
    setCliente(null);
    setClienteNuevo({ nombre: "", telefono: "", correo: "" });
    setTelefonoAlterno("");
    setSerial("");
    setProducto(null);
    setProductoNuevo((p) => ({ ...p, marca: "", modelo: "" }));
    setMarcaOtra(false);
    setModeloOtro(false);
    setMotivo("");
    setInfoAdicional("");
    setRepuestos([]);
    setValorServicio(0);
    setAbono(0);
    setMontoRecibido(0);
    setTipoAcceso("");
    setPinAcceso("");
    setPatronAcceso([]);
    setOtroAcceso("");
    setNotaAcceso("");
    setResultado(null);
  }

  // Al menos una foto: es la evidencia de cómo llegó el equipo, y la
  // misma que exige lib/estados.ts (tiene_foto_entrada) para diagnosticar.
  const tieneFoto = evidencia.some((a) => a.tipo === "foto");
  const faltante = !tieneFoto
    ? "Falta la foto del equipo recibido."
    : !motivo.trim()
      ? "Falta el motivo para poder guardar."
      : abono > valorServicio
        ? "El abono no puede ser mayor al valor del servicio."
        : abono > 0 && turnoAbierto === false
          ? "Para recibir un abono, abre el turno de caja."
          : abono > 0 && metodo?.es_efectivo && montoRecibido < abono
            ? "El efectivo recibido no alcanza el abono."
            : null;

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
        {resultado.serialGenerado && (
          <p style={{ margin: "8px 0 0", color: "var(--ink-2)" }}>
            Serial del equipo: <strong className="cifra">{resultado.serialGenerado}</strong>
          </p>
        )}
        <p style={{ margin: "8px 0 20px", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Printer size={17} strokeWidth={2} aria-hidden />
          El comprobante y la etiqueta se están imprimiendo en la estación de esta sede.
        </p>
        <div style={{ maxWidth: 420, margin: "0 auto 20px" }}>
          <EnlaceOrden
            ordenId={resultado.ordenId}
            tokenPublico={resultado.tokenPublico}
            abrirWhatsapp={resultado.enviarWhatsapp}
            tamano="md"
          />
        </div>
        {resultado.valorServicio > 0 && (
          <p className="cifra" style={{ margin: "0 0 16px", color: "var(--ink-2)" }}>
            Valor {formatearMoneda(resultado.valorServicio)}
            {resultado.abono > 0 ? ` · Abono ${formatearMoneda(resultado.abono)}` : ""} · Saldo{" "}
            <strong>{formatearMoneda(resultado.valorServicio - resultado.abono)}</strong>
          </p>
        )}
        {resultado.faltantesCompras.length > 0 && (
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <Aviso tono="info" icono={<ShoppingBag size={17} strokeWidth={2} />}>
              Pasó a Compras por falta de existencia: {resultado.faltantesCompras.join(", ")}.
            </Aviso>
          </div>
        )}
        {resultado.faltantesFallidos && (
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <Aviso tono="peligro">
              La orden quedó creada pero los repuestos faltantes no llegaron a Compras. Márcalos desde los repuestos de la orden.
            </Aviso>
          </div>
        )}
        {resultado.abonoFallido && (
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <Aviso tono="peligro">
              La orden quedó creada pero el abono no se registró. Regístralo desde Abonos.
            </Aviso>
          </div>
        )}
        {resultado.evidenciaFallida > 0 && (
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <Aviso tono="peligro">
              {resultado.evidenciaFallida === 1
                ? "Una foto o video no se pudo subir."
                : `${resultado.evidenciaFallida} fotos o videos no se pudieron subir.`}{" "}
              Súbelos desde la evidencia de la orden.
            </Aviso>
          </div>
        )}
        <div className="fila" style={{ justifyContent: "center" }}>
          <Boton variante="primario" icono={<Inbox size={18} strokeWidth={2} />} onClick={nuevaRecepcion}>
            Recibir otro equipo
          </Boton>
          {resultado.evidenciaFallida > 0 && (
            <Boton
              variante="contorno"
              icono={<Camera size={18} strokeWidth={2} />}
              onClick={() => router.push(`/orden/${resultado.ordenId}/evidencia`)}
            >
              Subir evidencia
            </Boton>
          )}
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
        descripcion="Evidencia, cliente, equipo y motivo. Al guardar se imprime el comprobante y la etiqueta."
      />

      <div className="pila">
        <Paso n={1} titulo="Evidencia de ingreso" icono={<Camera size={18} strokeWidth={2} color="var(--ink-2)" />}>
          <EvidenciaIngreso archivos={evidencia} onChange={setEvidencia} onError={setErrorEvidencia} />
          {errorEvidencia && (
            <div style={{ marginTop: 12 }}>
              <Aviso tono="peligro">{errorEvidencia}</Aviso>
            </div>
          )}
        </Paso>

        <Paso n={2} titulo="Cliente" icono={<User size={18} strokeWidth={2} color="var(--ink-2)" />}>
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

          {pideTelefonoAlterno && (
            <div style={{ marginTop: 12 }}>
              <Campo
                etiqueta="Número alternativo de contacto"
                ayuda="Un familiar o el trabajo: el cliente deja su celular, así que por aquí se le envía el enlace por WhatsApp."
              >
                <input
                  placeholder="300 000 0000"
                  value={telefonoAlterno}
                  onChange={(e) => setTelefonoAlterno(e.target.value)}
                  inputMode="tel"
                />
              </Campo>
            </div>
          )}
        </Paso>

        <Paso n={3} titulo="Equipo" icono={<Wrench size={18} strokeWidth={2} color="var(--ink-2)" />}>
          <form
            className="fila"
            style={{ gap: 8, marginBottom: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              buscarProducto();
            }}
          >
            <input
              style={{ flex: "1 1 220px", minWidth: 0 }}
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
            <Boton
              type="button"
              variante="contorno"
              icono={<Barcode size={17} strokeWidth={2} />}
              onClick={() => setEscaneando(true)}
            >
              Escanear
            </Boton>
          </form>

          {escaneando && (
            <div style={{ marginBottom: 14 }}>
              <LectorCodigoBarras
                formats={["code_128", "ean_13", "upc_a"]}
                etiqueta="Ubica el código de barras del serial"
                onDetectado={(valor) => {
                  setEscaneando(false);
                  setSerial(valor);
                  setProducto(null);
                  buscarProducto(valor);
                }}
                onCerrar={() => setEscaneando(false)}
              />
            </div>
          )}

          {producto ? (
            <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
              <strong>
                {producto.marca} {producto.modelo}
              </strong>{" "}
              ({producto.tipo})
            </Aviso>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 12 }}>
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
                {marcas.length > 0 && (
                  <select
                    value={marcaOtra ? OTRA : productoNuevo.marca}
                    onChange={(e) => {
                      const otra = e.target.value === OTRA;
                      setMarcaOtra(otra);
                      setModeloOtro(otra);
                      setProductoNuevo((p) => ({ ...p, marca: otra ? "" : e.target.value, modelo: "" }));
                    }}
                  >
                    <option value="">Escoge la marca</option>
                    {marcas.map((m) => (
                      <option key={m.marca} value={m.marca}>
                        {m.marca}
                      </option>
                    ))}
                    <option value={OTRA}>Otra marca…</option>
                  </select>
                )}
                {(marcas.length === 0 || marcaOtra) && (
                  <input
                    placeholder="Escribe la marca"
                    style={marcas.length > 0 ? { marginTop: 6 } : undefined}
                    value={productoNuevo.marca}
                    onChange={(e) => setProductoNuevo((p) => ({ ...p, marca: e.target.value }))}
                  />
                )}
              </Campo>
              <Campo etiqueta="Modelo">
                {modelosDeMarca.length > 0 && (
                  <select
                    value={modeloOtro ? OTRA : productoNuevo.modelo}
                    onChange={(e) => {
                      const otro = e.target.value === OTRA;
                      setModeloOtro(otro);
                      setProductoNuevo((p) => ({ ...p, modelo: otro ? "" : e.target.value }));
                    }}
                  >
                    <option value="">Escoge el modelo</option>
                    {modelosDeMarca.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value={OTRA}>Otro modelo…</option>
                  </select>
                )}
                {(modelosDeMarca.length === 0 || modeloOtro) && (
                  <input
                    placeholder="Escribe el modelo"
                    style={modelosDeMarca.length > 0 ? { marginTop: 6 } : undefined}
                    value={productoNuevo.modelo}
                    onChange={(e) => setProductoNuevo((p) => ({ ...p, modelo: e.target.value }))}
                  />
                )}
              </Campo>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <Campo etiqueta="Info adicional" ayuda="Lo que nota quien recibe, ej. &quot;trae cargador y forro&quot;. Opcional.">
              <input
                placeholder="Opcional"
                value={infoAdicional}
                onChange={(e) => setInfoAdicional(e.target.value)}
              />
            </Campo>
          </div>
        </Paso>

        <Paso n={4} titulo="Acceso" icono={<KeyRound size={18} strokeWidth={2} color="var(--ink-2)" />}>
          <p className="campo-ayuda" style={{ marginTop: 0, marginBottom: 12 }}>
            Opcional -- solo si el servicio necesita entrar al equipo. Se borra solo al entregarlo.
          </p>
          <div className="fila" style={{ gap: 8, marginBottom: 14 }}>
            {(
              [
                { valor: "", etiqueta: "Sin acceso" },
                { valor: "pin3", etiqueta: "PIN de 3" },
                { valor: "pin4", etiqueta: "PIN de 4" },
                { valor: "pin6", etiqueta: "PIN de 6" },
                // Siempre visible: antes dependía de que el tipo fuera "celular",
                // y con el tipo por defecto (patineta) el patrón no aparecía.
                { valor: "patron", etiqueta: "Patrón" },
                { valor: "otro", etiqueta: "Otro" },
              ] as const
            ).map((o) => (
              <Boton
                key={o.valor}
                tamano="sm"
                variante={tipoAcceso === o.valor ? "primario" : "contorno"}
                onClick={() => setTipoAcceso(o.valor)}
                aria-pressed={tipoAcceso === o.valor}
              >
                {o.etiqueta}
              </Boton>
            ))}
          </div>

          {(tipoAcceso === "pin3" || tipoAcceso === "pin4" || tipoAcceso === "pin6") && (
            <Campo etiqueta="PIN">
              <input
                value={pinAcceso}
                onChange={(e) => setPinAcceso(e.target.value.replace(/\D/g, ""))}
                maxLength={tipoAcceso === "pin3" ? 3 : tipoAcceso === "pin4" ? 4 : 6}
                inputMode="numeric"
                className="cifra"
                style={{ maxWidth: 140 }}
              />
            </Campo>
          )}

          {tipoAcceso === "patron" && <PatronGrid valor={patronAcceso} onChange={setPatronAcceso} />}

          {tipoAcceso === "otro" && (
            <Campo etiqueta="Contraseña o código de acceso">
              <input value={otroAcceso} onChange={(e) => setOtroAcceso(e.target.value)} />
            </Campo>
          )}

          {tipoAcceso && (
            <div style={{ marginTop: 12 }}>
              <Campo etiqueta="Nota" ayuda="Opcional, ej. &quot;solo huella, el PIN es de respaldo&quot;.">
                <input value={notaAcceso} onChange={(e) => setNotaAcceso(e.target.value)} />
              </Campo>
            </div>
          )}
        </Paso>

        <Paso n={5} titulo="Daño y motivo" icono={<FileText size={18} strokeWidth={2} color="var(--ink-2)" />}>
          <Campo ayuda="El daño identificado y el servicio que se va a realizar. Es lo que lee el técnico al abrir la orden.">
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              aria-label="Motivo de la recepción"
            />
          </Campo>
          <div style={{ marginTop: 14 }}>
            {/* No va en <Campo>: es un <label> y aquí hay varios controles. */}
            <span className="campo-etiqueta">Repuestos que necesita</span>
            <RepuestosNecesarios repuestos={repuestos} onChange={setRepuestos} />
            <div className="campo-ayuda">
              Opcional. Si ya se sabe qué repuesto lleva: lo que no hay en esta sede pasa solo a la lista de Compras,
              vinculado a esta orden. Se compra cuando el cliente apruebe.
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <Campo etiqueta="Valor del servicio" ayuda="Opcional. Queda en la cuenta de la orden y en el comprobante.">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                className="cifra"
                value={valorServicio || ""}
                onChange={(e) => {
                  const valor = Math.max(0, Number(e.target.value) || 0);
                  setValorServicio(valor);
                  if (!valor) setAbono(0);
                }}
                placeholder="0"
                style={{ maxWidth: 200 }}
              />
            </Campo>
          </div>
        </Paso>

        {valorServicio > 0 && (
          <Paso n={6} titulo="Abono" icono={<Wallet size={18} strokeWidth={2} color="var(--ink-2)" />}>
            <div className="fila" style={{ gap: 12, alignItems: "flex-end", marginBottom: 14 }}>
              <Campo etiqueta="Abono del cliente" ayuda="Opcional. Entra a la caja y a la cuenta de este equipo.">
                <input
                  type="number"
                  min={0}
                  max={valorServicio}
                  inputMode="numeric"
                  className="cifra"
                  value={abono || ""}
                  onChange={(e) => setAbono(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                  style={{ maxWidth: 200 }}
                />
              </Campo>
              <div className="cifra" style={{ paddingBottom: 10 }}>
                Saldo restante: <strong>{formatearMoneda(saldo)}</strong>
              </div>
            </div>
            {abono > 0 && turnoAbierto === false && <AvisoTurnoCerrado />}
            {abono > 0 && metodos.length > 0 && (
              <PanelCobro
                total={abono}
                metodos={metodos}
                metodoPagoId={metodoPagoId}
                onCambiarMetodo={setMetodoPagoId}
                montoRecibido={montoRecibido}
                onCambiarMontoRecibido={setMontoRecibido}
                // El abono sale en el comprobante de recepción, no lleva ticket aparte.
                ocultarImprimir
                imprimir={false}
                onCambiarImprimir={() => {}}
              />
            )}
          </Paso>
        )}

        <div className="fila">
          <Boton
            variante="primario"
            tamano="lg"
            icono={<Printer size={19} strokeWidth={2} />}
            disabled={guardando || Boolean(faltante)}
            onClick={() => guardar()}
          >
            {guardando ? "Guardando…" : "Recibir e imprimir"}
          </Boton>
          {/* Aparte, a propósito: guarda e imprime igual que el de al
              lado y además abre el mensaje con el enlace de seguimiento,
              listo para mandar al cliente. */}
          <Boton
            variante="contorno"
            tamano="lg"
            icono={<MessageCircle size={19} strokeWidth={2} />}
            disabled={guardando || Boolean(faltante)}
            onClick={() => guardar(true)}
          >
            Enviar por WhatsApp
          </Boton>
          {faltante && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{faltante}</span>}
        </div>

        {error && <Aviso tono="peligro">{error}</Aviso>}
      </div>
    </div>
  );
}
