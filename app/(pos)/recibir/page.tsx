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
 * serial) antes de pedir llenar nada más, y por eso los pasos son
 * tres bloques numerados en una sola pantalla (cliente; equipo con
 * fotos/video, marca y modelo, serial y acceso; daño y motivo con valor y
 * abono), sin asistente ni pestañas: quien recibe ve de un vistazo lo
 * que le falta. Lo poco usado va plegado en «Más datos» y los botones
 * de guardar quedan fijos abajo.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Search, Check, Printer, Barcode, Camera, ShoppingBag, MessageCircle, Pencil } from "lucide-react";
import { LectorCodigoBarras } from "@/componentes/lector-codigos/lector-codigo-barras";
import { PatronGrid } from "@/componentes/patron-android/patron-grid";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { VentanaError } from "@/componentes/ui/ventana-error";
import { PanelCobro, formatearMoneda } from "@/componentes/cobro/panel-cobro";
import { useTurnoAbierto, AvisoTurnoCerrado } from "@/componentes/caja/aviso-turno";
import { EvidenciaIngreso, subirEvidenciaIngreso, type ArchivoIngreso } from "@/componentes/recepcion/evidencia-ingreso";
import { RepuestosNecesarios, type RepuestoElegido } from "@/componentes/recepcion/repuestos-necesarios";
import { EnlaceOrden } from "@/componentes/taller/enlace-orden";
import { UltimasRecepciones, reimprimirComprobante, rutaCorregir } from "@/componentes/recepcion/ultimas-recepciones";
import type { MarcaConModelos } from "@/lib/modelos-equipo";
import { pareceCelular, sePuedeBuscarCliente, type ClienteEncontrado } from "@/lib/busqueda-cliente";

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

/** Un bloque numerado; con `listo` el número pasa a un visto. */
function Paso({ n, titulo, listo, children }: { n: number; titulo: string; listo?: boolean; children: React.ReactNode }) {
  return (
    // El id permite que la ventana de "lo que falta" lleve al paso pendiente.
    <div id={`paso-${n}`} style={{ scrollMarginTop: 80 }}>
      <Tarjeta>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span
            className="cifra"
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: listo ? "var(--ok)" : "var(--accent)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {listo ? <Check size={14} strokeWidth={3} /> : n}
          </span>
          <h2 style={{ fontSize: 16 }}>{titulo}</h2>
        </div>
        {children}
      </Tarjeta>
    </div>
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
  // Varios clientes coinciden (p. ej. el mismo teléfono): se elige uno.
  const [opcionesCliente, setOpcionesCliente] = useState<ClienteEncontrado[]>([]);
  const [sinCoincidencia, setSinCoincidencia] = useState(false);
  const busquedaCliente = useRef(0);
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

  const [tipoAcceso, setTipoAcceso] = useState<"" | "pin" | "patron" | "contrasena" | "otro">("");
  const [pinAcceso, setPinAcceso] = useState("");
  const [patronAcceso, setPatronAcceso] = useState<number[]>([]);
  const [contrasenaAcceso, setContrasenaAcceso] = useState("");
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
  const [avisoReimpresion, setAvisoReimpresion] = useState<string | null>(null);
  // Lo que falta para guardar, en la ventana emergente; `paso` es a dónde
  // se lleva la pantalla al cerrarla.
  const [faltantesVisibles, setFaltantesVisibles] = useState<{ mensaje: string; paso: number }[] | null>(null);

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

  // Busca por documento o teléfono (lib/busqueda-cliente.ts). Si hay un
  // solo cliente, queda elegido y sus datos llenan el paso; si hay
  // varios, se listan. Solo cuenta la última búsqueda lanzada.
  async function buscarCliente(texto: string, desde: "documento" | "telefono") {
    const valor = texto.trim();
    if (!sePuedeBuscarCliente(valor)) return;
    const turno = ++busquedaCliente.current;
    setBuscandoCliente(true);
    try {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(valor)}`);
      const data: { clientes?: ClienteEncontrado[] } = res.ok ? await res.json() : {};
      if (turno !== busquedaCliente.current) return;
      const clientes = data.clientes ?? [];
      if (clientes.length === 1) {
        elegirCliente(clientes[0]!);
      } else {
        setOpcionesCliente(clientes);
        setSinCoincidencia(desde === "documento" && clientes.length === 0);
        // Nadie con ese número: lo escrito arriba era el celular del cliente nuevo.
        if (desde === "documento" && clientes.length === 0 && pareceCelular(valor)) {
          setClienteNuevo((c) => (c.telefono.trim() ? c : { ...c, telefono: valor }));
        }
      }
    } catch {
      // Sin red: se sigue con el cliente nuevo.
    } finally {
      if (turno === busquedaCliente.current) setBuscandoCliente(false);
    }
  }

  function elegirCliente(c: ClienteEncontrado) {
    setCliente(c);
    setOpcionesCliente([]);
    setSinCoincidencia(false);
    if (c.documento && !documento.trim()) setDocumento(c.documento);
  }

  function cambiarCliente() {
    busquedaCliente.current++;
    setCliente(null);
    setOpcionesCliente([]);
    setSinCoincidencia(false);
    setDocumento("");
  }

  // Busca sola mientras se escribe el documento o el teléfono.
  useEffect(() => {
    if (cliente || !sePuedeBuscarCliente(documento)) return;
    const t = setTimeout(() => buscarCliente(documento, "documento"), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documento, cliente]);

  useEffect(() => {
    if (cliente || !sePuedeBuscarCliente(clienteNuevo.telefono)) return;
    const t = setTimeout(() => buscarCliente(clienteNuevo.telefono, "telefono"), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteNuevo.telefono, cliente]);

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
          tipoAcceso === "patron"
            ? patronAcceso.join("-")
            : tipoAcceso === "contrasena"
              ? contrasenaAcceso.trim()
              : tipoAcceso === "otro"
                ? otroAcceso.trim()
                : pinAcceso.trim();
        if (valor) {
          body.acceso = { tipo: tipoAcceso, valor, nota: notaAcceso.trim() || undefined };
        }
      }

      if (cliente) body.clienteId = cliente.id;
      else {
        if (!clienteNuevo.nombre.trim()) throw new Error("Falta el nombre del cliente");
        body.clienteNuevo = { nombre: clienteNuevo.nombre.trim(), documento: (!pareceCelular(documento) && documento.trim()) || undefined, telefono: clienteNuevo.telefono || undefined, correo: clienteNuevo.correo || undefined };
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
    cambiarCliente();
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
    setContrasenaAcceso("");
    setOtroAcceso("");
    setNotaAcceso("");
    setAvisoReimpresion(null);
    setResultado(null);
  }

  // La foto o video de ingreso es opcional: se toma si se quiere.
  const faltantes: { mensaje: string; paso: number }[] = [];
  if (!cliente && !clienteNuevo.nombre.trim()) faltantes.push({ mensaje: "Falta el nombre del cliente.", paso: 1 });
  if (pideTelefonoAlterno && telefonoAlterno.replace(/\D/g, "").length < 7)
    faltantes.push({ mensaje: "Falta el número alternativo de contacto.", paso: 1 });
  if (!motivo.trim()) faltantes.push({ mensaje: "Falta el daño y motivo del servicio.", paso: 3 });
  if (abono > valorServicio) faltantes.push({ mensaje: "El abono no puede ser mayor al valor del servicio.", paso: 3 });
  else if (abono > 0 && turnoAbierto === false)
    faltantes.push({ mensaje: "Para recibir un abono, abre el turno de caja.", paso: 3 });
  else if (abono > 0 && metodo?.es_efectivo && montoRecibido < abono)
    faltantes.push({ mensaje: "El efectivo recibido no alcanza el abono.", paso: 3 });

  function intentarGuardar(enviarWhatsapp = false) {
    if (faltantes.length) {
      setFaltantesVisibles(faltantes);
      return;
    }
    guardar(enviarWhatsapp);
  }

  function cerrarFaltantes() {
    const paso = faltantesVisibles?.[0]?.paso;
    setFaltantesVisibles(null);
    if (paso) document.getElementById(`paso-${paso}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
              La orden quedó creada pero el abono no se registró. Regístralo desde Cobrar y entregar.
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
            icono={<Printer size={18} strokeWidth={2} />}
            onClick={async () => {
              setAvisoReimpresion("Enviando…");
              try {
                await reimprimirComprobante(resultado.ordenId);
                setAvisoReimpresion("Recibo enviado de nuevo a la impresora.");
              } catch (e) {
                setAvisoReimpresion(e instanceof Error ? e.message : "No se pudo reimprimir el recibo");
              }
            }}
          >
            Reimprimir recibo
          </Boton>
          <Boton
            variante="contorno"
            icono={<Pencil size={18} strokeWidth={2} />}
            onClick={() => router.push(rutaCorregir(resultado.ordenId, "/recibir"))}
          >
            Corregir y reimprimir
          </Boton>
        </div>
        {avisoReimpresion && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--ink-2)" }}>{avisoReimpresion}</p>
        )}
      </Tarjeta>
    );
  }

  return (
    <div>
      <TituloPantalla titulo="Recibir equipo" acciones={<UltimasRecepciones />} />

      <div className="pila">
        <Paso n={1} titulo="Cliente" listo={Boolean(cliente)}>
          {cliente ? (
            <div className="fila" style={{ gap: 8, justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ minWidth: 0 }}>
                <strong>{cliente.nombre}</strong>
                {cliente.documento ? <span className="cifra" style={{ color: "var(--ink-2)" }}> · {cliente.documento}</span> : ""}
                {cliente.telefono ? <span className="cifra" style={{ color: "var(--ink-2)" }}> · {cliente.telefono}</span> : ""}
              </span>
              <Boton type="button" variante="fantasma" tamano="sm" onClick={cambiarCliente}>
                Cambiar
              </Boton>
            </div>
          ) : (
            <>
              {/* Busca sola al escribir; Enter busca de una vez. */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  buscarCliente(documento, "documento");
                }}
                style={{ marginBottom: 12, position: "relative" }}
              >
                <input
                  placeholder="Documento o teléfono del cliente"
                  value={documento}
                  onChange={(e) => {
                    setDocumento(e.target.value);
                    setCliente(null);
                    setSinCoincidencia(false);
                  }}
                  aria-label="Documento o teléfono del cliente"
                  style={{ paddingRight: 40 }}
                />
                <Search
                  size={17}
                  strokeWidth={2}
                  aria-hidden
                  color="var(--ink-3)"
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", opacity: buscandoCliente ? 0.4 : 1 }}
                />
              </form>

              {opcionesCliente.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ color: "var(--ink-2)", fontSize: 14 }}>Varios clientes coinciden:</div>
                  {opcionesCliente.map((c) => (
                    <Boton key={c.id} type="button" variante="contorno" ancho onClick={() => elegirCliente(c)}>
                      {c.nombre}
                      {c.documento ? ` · ${c.documento}` : ""}
                      {c.telefono ? ` · ${c.telefono}` : ""}
                    </Boton>
                  ))}
                  <Boton type="button" variante="fantasma" tamano="sm" onClick={() => setOpcionesCliente([])}>
                    Es un cliente nuevo
                  </Boton>
                </div>
              ) : (
                <>
                  {sinCoincidencia && !buscandoCliente && (
                    <div style={{ marginBottom: 10, color: "var(--ink-2)", fontSize: 13 }}>Cliente nuevo: llena sus datos.</div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                    <input
                      placeholder="Nombre y apellido"
                      aria-label="Nombre del cliente"
                      value={clienteNuevo.nombre}
                      onChange={(e) => setClienteNuevo((c) => ({ ...c, nombre: e.target.value }))}
                    />
                    <input
                      placeholder="Teléfono"
                      aria-label="Teléfono del cliente"
                      inputMode="tel"
                      value={clienteNuevo.telefono}
                      onChange={(e) => setClienteNuevo((c) => ({ ...c, telefono: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {pideTelefonoAlterno && (
            <div style={{ marginTop: 12 }}>
              <Campo etiqueta="Número alternativo" ayuda="Un familiar o el trabajo: por aquí se le escribe mientras su celular está en el taller.">
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

        <Paso n={2} titulo="Equipo" listo={Boolean(producto)}>
          <div style={{ marginBottom: 12 }}>
            <EvidenciaIngreso archivos={evidencia} onChange={setEvidencia} onError={setErrorEvidencia} compacto />
            {errorEvidencia && (
              <div style={{ marginTop: 12 }}>
                <Aviso tono="peligro">{errorEvidencia}</Aviso>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            {producto ? (
              <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
                <strong>
                  {producto.marca} {producto.modelo}
                </strong>{" "}
                ({producto.tipo}) · ya estaba registrado
              </Aviso>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 10 }}>
                <select
                  aria-label="Tipo de equipo"
                  value={productoNuevo.tipo}
                  onChange={(e) => setProductoNuevo((p) => ({ ...p, tipo: e.target.value }))}
                >
                  <option value="patineta">Patineta</option>
                  <option value="celular">Celular</option>
                  <option value="computador">Computador</option>
                </select>
                <div>
                  {marcas.length > 0 && (
                    <select
                      aria-label="Marca"
                      value={marcaOtra ? OTRA : productoNuevo.marca}
                      onChange={(e) => {
                        const otra = e.target.value === OTRA;
                        setMarcaOtra(otra);
                        setModeloOtro(otra);
                        setProductoNuevo((p) => ({ ...p, marca: otra ? "" : e.target.value, modelo: "" }));
                      }}
                    >
                      <option value="">Marca</option>
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
                      aria-label="Marca"
                      style={marcas.length > 0 ? { marginTop: 6 } : undefined}
                      value={productoNuevo.marca}
                      onChange={(e) => setProductoNuevo((p) => ({ ...p, marca: e.target.value }))}
                    />
                  )}
                </div>
                <div>
                  {modelosDeMarca.length > 0 && (
                    <select
                      aria-label="Modelo"
                      value={modeloOtro ? OTRA : productoNuevo.modelo}
                      onChange={(e) => {
                        const otro = e.target.value === OTRA;
                        setModeloOtro(otro);
                        setProductoNuevo((p) => ({ ...p, modelo: otro ? "" : e.target.value }));
                      }}
                    >
                      <option value="">Modelo</option>
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
                      aria-label="Modelo"
                      style={modelosDeMarca.length > 0 ? { marginTop: 6 } : undefined}
                      value={productoNuevo.modelo}
                      onChange={(e) => setProductoNuevo((p) => ({ ...p, modelo: e.target.value }))}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              buscarProducto();
            }}
            className="fila"
            style={{ gap: 8, flexWrap: "nowrap" }}
          >
            <input
              style={{ flex: 1, minWidth: 0 }}
              placeholder="Serial (vacío = se genera al guardar)"
              value={serial}
              onChange={(e) => {
                setSerial(e.target.value);
                setProducto(null);
              }}
              onBlur={() => {
                if (serial.trim() && !producto && !buscandoProducto) buscarProducto();
              }}
              aria-label="Serial del equipo"
            />
            <Boton
              type="button"
              variante="contorno"
              icono={<Barcode size={18} strokeWidth={2} />}
              onClick={() => setEscaneando(true)}
              aria-label="Escanear el código de barras del serial"
              title="Escanear"
            />
          </form>

          {escaneando && (
            <div style={{ marginTop: 12 }}>
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

          {/* El acceso al equipo, opcional; se borra solo al entregarlo. */}
          <div className="fila" style={{ gap: 6, marginTop: 14, alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginRight: 4 }}>Acceso</span>
            {(
              [
                { valor: "", etiqueta: "Ninguno" },
                { valor: "pin", etiqueta: "PIN" },
                { valor: "patron", etiqueta: "Patrón" },
                { valor: "contrasena", etiqueta: "Contraseña" },
                { valor: "otro", etiqueta: "Otro" },
              ] as const
            ).map((o) => (
              <button
                key={o.valor}
                type="button"
                className={`pastilla${tipoAcceso === o.valor ? " pastilla-activa" : ""}`}
                onClick={() => setTipoAcceso(o.valor)}
                aria-pressed={tipoAcceso === o.valor}
              >
                {o.etiqueta}
              </button>
            ))}
          </div>

          {tipoAcceso && (
            <div className="pila" style={{ gap: 10, marginTop: 12 }}>
              {tipoAcceso === "pin" && (
                <input
                  value={pinAcceso}
                  onChange={(e) => setPinAcceso(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  className="cifra"
                  placeholder="PIN (solo números)"
                  aria-label="PIN"
                  style={{ maxWidth: 220 }}
                />
              )}
              {tipoAcceso === "patron" && <PatronGrid valor={patronAcceso} onChange={setPatronAcceso} />}
              {tipoAcceso === "contrasena" && (
                <input
                  value={contrasenaAcceso}
                  onChange={(e) => setContrasenaAcceso(e.target.value)}
                  placeholder="Contraseña, tal como la dicta el cliente"
                  aria-label="Contraseña"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              )}
              {tipoAcceso === "otro" && (
                <input
                  value={otroAcceso}
                  onChange={(e) => setOtroAcceso(e.target.value)}
                  placeholder="Cómo se entra, ej. cuenta Google del cliente"
                  aria-label="Método de acceso"
                />
              )}
              <input
                value={notaAcceso}
                onChange={(e) => setNotaAcceso(e.target.value)}
                placeholder="Nota (opcional), ej. solo huella"
                aria-label="Nota del acceso"
              />
            </div>
          )}
        </Paso>

        <Paso n={3} titulo="Daño y motivo" listo={Boolean(motivo.trim())}>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="El daño y el servicio que se va a hacer"
            aria-label="Daño y motivo"
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 12 }}>
            <Campo etiqueta="Valor del servicio">
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
                placeholder="Opcional"
              />
            </Campo>
            <Campo etiqueta="Abono">
              <input
                type="number"
                min={0}
                max={valorServicio}
                inputMode="numeric"
                className="cifra"
                value={abono || ""}
                onChange={(e) => setAbono(Math.max(0, Number(e.target.value) || 0))}
                placeholder={valorServicio > 0 ? "Opcional" : "Pon primero el valor"}
                disabled={!(valorServicio > 0)}
              />
            </Campo>
          </div>
          {valorServicio > 0 && abono > 0 && (
            <div className="cifra" style={{ marginTop: 8, fontSize: 13, color: "var(--ink-2)" }}>
              Saldo: <strong>{formatearMoneda(saldo)}</strong>
            </div>
          )}
          {abono > 0 && turnoAbierto === false && (
            <div style={{ marginTop: 12 }}>
              <AvisoTurnoCerrado />
            </div>
          )}
          {abono > 0 && metodos.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <PanelCobro
                total={abono}
                metodos={metodos}
                metodoPagoId={metodoPagoId}
                onCambiarMetodo={setMetodoPagoId}
                montoRecibido={montoRecibido}
                onCambiarMontoRecibido={setMontoRecibido}
                ocultarImprimir
                imprimir={false}
                onCambiarImprimir={() => {}}
              />
            </div>
          )}
        </Paso>

        <details className="mas-opciones">
          <summary>Más datos: info adicional y repuestos que necesita</summary>
          <div className="pila" style={{ gap: 14, marginTop: 12 }}>
            <Campo etiqueta="Info adicional">
              <input
                placeholder="Ej. trae cargador y forro"
                value={infoAdicional}
                onChange={(e) => setInfoAdicional(e.target.value)}
              />
            </Campo>
            <div>
              {/* No va en <Campo>: es un <label> y aquí hay varios controles. */}
              <span className="campo-etiqueta">Repuestos que necesita</span>
              <RepuestosNecesarios repuestos={repuestos} onChange={setRepuestos} />
              <div className="campo-ayuda">Lo que no hay en esta sede pasa a Compras con el número de la orden.</div>
            </div>
          </div>
        </details>

        {/* Fija abajo: guardar siempre a la vista, sin bajar hasta el final. */}
        <div className="barra-acciones">
          {/* Guarda e imprime igual que el principal y además abre el
              mensaje con el enlace de seguimiento para el cliente. */}
          <Boton
            variante="contorno"
            icono={<MessageCircle size={18} strokeWidth={2} />}
            disabled={guardando}
            onClick={() => intentarGuardar(true)}
          >
            WhatsApp
          </Boton>
          <Boton
            variante="primario"
            icono={<Printer size={18} strokeWidth={2} />}
            disabled={guardando}
            onClick={() => intentarGuardar()}
          >
            {guardando ? "Guardando…" : "Recibir e imprimir"}
          </Boton>
        </div>

        <VentanaError
          mensaje={faltantesVisibles?.map((f) => f.mensaje)}
          titulo="Falta información para guardar"
          onCerrar={cerrarFaltantes}
        />
        <VentanaError mensaje={error} onCerrar={() => setError(null)} />
      </div>
    </div>
  );
}
