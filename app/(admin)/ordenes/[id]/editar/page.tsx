"use client";

/**
 * Corregir los datos de una orden después de recibir el equipo: un
 * nombre mal escrito, otro teléfono, el serial, el motivo. Vive en la
 * puerta de administración para que recepción también llegue (la
 * pantalla de la orden es del taller). La ruta es
 * app/api/ordenes/[id]/datos/route.ts; lo que cambió queda en el
 * historial de la orden con quién lo cambió.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { User, Wrench, FileText, KeyRound, Check, Printer } from "lucide-react";
import { Boton, BotonEnlace } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { VentanaError } from "@/componentes/ui/ventana-error";
import { PatronGrid } from "@/componentes/patron-android/patron-grid";
import { reimprimirComprobante } from "@/componentes/recepcion/ultimas-recepciones";
import { validarDatos, type DatosEdicion } from "@/lib/orden-edicion";
import type { MarcaConModelos } from "@/lib/modelos-equipo";

interface Respuesta extends DatosEdicion {
  numero: number;
  editable: boolean;
  otrasOrdenesCliente: number;
  puedeEditarAcceso: boolean;
}

type TipoAcceso = "" | "pin" | "patron" | "contrasena" | "otro";

const OPCIONES_ACCESO: { valor: TipoAcceso; etiqueta: string }[] = [
  { valor: "", etiqueta: "Sin acceso" },
  { valor: "pin", etiqueta: "PIN" },
  { valor: "patron", etiqueta: "Patrón" },
  { valor: "contrasena", etiqueta: "Contraseña" },
  { valor: "otro", etiqueta: "Otros" },
];

function Seccion({ titulo, icono, children }: { titulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <Tarjeta>
      <h2 style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        {icono}
        {titulo}
      </h2>
      {children}
    </Tarjeta>
  );
}

const rejilla: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
  gap: 12,
};

export default function PaginaEditarOrden() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [error, setError] = useState<string | string[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [marcas, setMarcas] = useState<MarcaConModelos[]>([]);
  // A dónde volver: la pantalla de la orden si se llegó desde ahí.
  const [volver, setVolver] = useState("/ordenes");
  // Desde Recibir (?reimprimir=1) lo normal es corregir y sacar el recibo de nuevo.
  const [reimprimirPrimero, setReimprimirPrimero] = useState(false);

  // Acceso al equipo: no se carga hasta que se pide cambiarlo.
  const [cambiarAcceso, setCambiarAcceso] = useState(false);
  const [tipoAcceso, setTipoAcceso] = useState<TipoAcceso>("");
  const [valorAcceso, setValorAcceso] = useState("");
  const [patron, setPatron] = useState<number[]>([]);
  const [notaAcceso, setNotaAcceso] = useState("");

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("volver");
    if (v && v.startsWith("/") && !v.startsWith("//")) setVolver(v);
    setReimprimirPrimero(new URLSearchParams(window.location.search).get("reimprimir") === "1");
    fetch(`/api/ordenes/${id}/datos`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "No se pudo cargar la orden");
        setDatos(j);
      })
      .catch((e) => setErrorCarga(e instanceof Error ? e.message : "No se pudo cargar la orden"));
    fetch("/api/productos/modelos")
      .then((r) => r.json())
      .then((j) => setMarcas(Array.isArray(j.marcas) ? j.marcas : []))
      .catch(() => {});
  }, [id]);

  async function abrirAcceso() {
    setCambiarAcceso(true);
    try {
      const res = await fetch(`/api/ordenes/${id}/acceso`);
      const a = res.ok ? ((await res.json()) as { tipo: string; valor: string; nota: string | null } | null) : null;
      if (!a) return;
      const tipo: TipoAcceso = a.tipo.startsWith("pin") ? "pin" : (a.tipo as TipoAcceso);
      setTipoAcceso(tipo);
      if (tipo === "patron") setPatron(a.valor.split("-").map(Number).filter((n) => n > 0));
      else setValorAcceso(a.valor);
      setNotaAcceso(a.nota ?? "");
    } catch {
      // Sin acceso registrado: se empieza en blanco.
    }
  }

  function cambiar<K extends "cliente" | "equipo" | "orden">(grupo: K, campo: keyof DatosEdicion[K], valor: string) {
    setDatos((d) => (d ? { ...d, [grupo]: { ...d[grupo], [campo]: valor } } : d));
  }

  async function guardar(reimprimir = false) {
    if (!datos) return;
    const faltas = validarDatos(datos);
    if (faltas.length > 0) {
      setError(faltas);
      return;
    }
    const body: Record<string, unknown> = {
      cliente: datos.cliente,
      equipo: datos.equipo,
      orden: datos.orden,
      valorServicio: datos.valorServicio,
    };
    if (cambiarAcceso) {
      const valor = tipoAcceso === "patron" ? patron.join("-") : valorAcceso.trim();
      body.acceso = tipoAcceso && valor ? { tipo: tipoAcceso, valor, nota: notaAcceso.trim() || undefined } : null;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/ordenes/${id}/datos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "No se pudieron guardar los cambios");
      if (reimprimir) {
        try {
          await reimprimirComprobante(id);
        } catch (e) {
          // Los cambios ya quedaron: se avisa y se puede reimprimir desde la orden.
          setError(`Los cambios se guardaron, pero ${e instanceof Error ? e.message.toLowerCase() : "el recibo no se pudo reimprimir"}.`);
          return;
        }
      }
      router.push(volver);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los cambios");
    } finally {
      setGuardando(false);
    }
  }

  if (errorCarga) return <Aviso tono="peligro">{errorCarga}</Aviso>;
  if (!datos) return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;

  const modelos = marcas.find((m) => m.marca.toLowerCase() === datos.equipo.marca.toLowerCase())?.modelos ?? [];
  const icono = (I: typeof User) => <I size={19} strokeWidth={2} color="var(--ink-2)" aria-hidden />;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <TituloPantalla
        titulo={`Editar orden #${datos.numero}`}
      />

      {!datos.editable ? (
        <Aviso tono="aviso">Esta orden ya se entregó: sus datos no se pueden cambiar.</Aviso>
      ) : (
        <div className="pila">
          <Seccion titulo="Cliente" icono={icono(User)}>
            {datos.otrasOrdenesCliente > 0 && (
              <p className="campo-ayuda" style={{ marginTop: 0, marginBottom: 12 }}>
                Este cliente tiene {datos.otrasOrdenesCliente}{" "}
                {datos.otrasOrdenesCliente === 1 ? "orden más" : "órdenes más"}: lo que corrijas aquí también se ve allá.
              </p>
            )}
            <div style={rejilla}>
              <Campo etiqueta="Nombre">
                <input value={datos.cliente.nombre} onChange={(e) => cambiar("cliente", "nombre", e.target.value)} />
              </Campo>
              <Campo etiqueta="Documento">
                <input
                  value={datos.cliente.documento}
                  onChange={(e) => cambiar("cliente", "documento", e.target.value)}
                  inputMode="numeric"
                />
              </Campo>
              <Campo etiqueta="Teléfono">
                <input
                  value={datos.cliente.telefono}
                  onChange={(e) => cambiar("cliente", "telefono", e.target.value)}
                  inputMode="tel"
                />
              </Campo>
              <Campo etiqueta="Correo">
                <input
                  value={datos.cliente.correo}
                  onChange={(e) => cambiar("cliente", "correo", e.target.value)}
                  inputMode="email"
                  autoCapitalize="none"
                />
              </Campo>
              <Campo etiqueta="Número alternativo" ayuda="De esta orden: por aquí se envía el enlace por WhatsApp.">
                <input
                  value={datos.orden.telefonoAlterno}
                  onChange={(e) => cambiar("orden", "telefonoAlterno", e.target.value)}
                  inputMode="tel"
                />
              </Campo>
            </div>
          </Seccion>

          <Seccion titulo="Equipo" icono={icono(Wrench)}>
            <div style={rejilla}>
              <Campo etiqueta="Tipo">
                <select value={datos.equipo.tipo} onChange={(e) => cambiar("equipo", "tipo", e.target.value)}>
                  {/* Un tipo viejo que no está en la lista se conserva. */}
                  {!["patineta", "celular", "computador"].includes(datos.equipo.tipo) && (
                    <option value={datos.equipo.tipo}>{datos.equipo.tipo}</option>
                  )}
                  <option value="patineta">Patineta</option>
                  <option value="celular">Celular</option>
                  <option value="computador">Computador</option>
                </select>
              </Campo>
              <Campo etiqueta="Serial">
                <input
                  value={datos.equipo.serial}
                  onChange={(e) => cambiar("equipo", "serial", e.target.value)}
                  className="cifra"
                  autoCapitalize="characters"
                />
              </Campo>
              <Campo etiqueta="Marca">
                <input
                  value={datos.equipo.marca}
                  onChange={(e) => cambiar("equipo", "marca", e.target.value)}
                  list="marcas-equipo"
                />
                <datalist id="marcas-equipo">
                  {marcas.map((m) => (
                    <option key={m.marca} value={m.marca} />
                  ))}
                </datalist>
              </Campo>
              <Campo etiqueta="Modelo">
                <input
                  value={datos.equipo.modelo}
                  onChange={(e) => cambiar("equipo", "modelo", e.target.value)}
                  list="modelos-equipo"
                />
                <datalist id="modelos-equipo">
                  {modelos.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Campo>
            </div>
            <p className="campo-ayuda" style={{ marginBottom: 0 }}>
              Si cambias el serial, la etiqueta QR ya impresa sigue sirviendo: lleva el código de la orden.
            </p>
          </Seccion>

          <Seccion titulo="Recepción" icono={icono(FileText)}>
            <div className="pila" style={{ gap: 12 }}>
              <Campo etiqueta="Daño y motivo">
                <textarea rows={3} value={datos.orden.motivo} onChange={(e) => cambiar("orden", "motivo", e.target.value)} />
              </Campo>
              <Campo etiqueta="Info adicional">
                <input
                  value={datos.orden.infoAdicional}
                  onChange={(e) => cambiar("orden", "infoAdicional", e.target.value)}
                  placeholder="Opcional"
                />
              </Campo>
              {datos.valorServicio !== null ? (
                <Campo etiqueta="Valor del servicio" ayuda="Los abonos no cambian. El valor no puede quedar por debajo de lo ya pagado.">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="cifra"
                    style={{ maxWidth: 220 }}
                    value={datos.valorServicio || ""}
                    placeholder="0"
                    onChange={(e) => setDatos((d) => (d ? { ...d, valorServicio: Number(e.target.value) || 0 } : d))}
                  />
                </Campo>
              ) : (
                <p className="campo-ayuda" style={{ margin: 0 }}>
                  El valor ya no se cambia aquí: la orden pasó a cotización, y el valor sale de la cotización y de los
                  repuestos de la orden.
                </p>
              )}
            </div>
          </Seccion>

          {datos.puedeEditarAcceso && (
            <Seccion titulo="Acceso al equipo" icono={icono(KeyRound)}>
              {!cambiarAcceso ? (
                <Boton variante="contorno" onClick={abrirAcceso}>
                  Cambiar acceso
                </Boton>
              ) : (
                <>
                  <div className="fila" style={{ gap: 8, marginBottom: 14 }}>
                    {OPCIONES_ACCESO.map((o) => (
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
                  {tipoAcceso === "pin" && (
                    <Campo etiqueta="PIN" ayuda="Solo números, de cualquier largo.">
                      <input
                        value={valorAcceso}
                        onChange={(e) => setValorAcceso(e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric"
                        className="cifra"
                        style={{ maxWidth: 220 }}
                      />
                    </Campo>
                  )}
                  {tipoAcceso === "patron" && <PatronGrid valor={patron} onChange={setPatron} />}
                  {(tipoAcceso === "contrasena" || tipoAcceso === "otro") && (
                    <Campo etiqueta={tipoAcceso === "otro" ? "Método de acceso" : "Contraseña"}>
                      <input
                        value={valorAcceso}
                        onChange={(e) => setValorAcceso(e.target.value)}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </Campo>
                  )}
                  {tipoAcceso && (
                    <div style={{ marginTop: 12 }}>
                      <Campo etiqueta="Nota" ayuda="Opcional.">
                        <input value={notaAcceso} onChange={(e) => setNotaAcceso(e.target.value)} />
                      </Campo>
                    </div>
                  )}
                </>
              )}
            </Seccion>
          )}

          <div className="fila" style={{ gap: 8, justifyContent: "flex-end" }}>
            <BotonEnlace href={volver} variante="fantasma">
              Cancelar
            </BotonEnlace>
            <Boton
              variante={reimprimirPrimero ? "contorno" : "primario"}
              icono={<Check size={18} strokeWidth={2.4} />}
              onClick={() => guardar()}
              disabled={guardando}
            >
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Boton>
            <Boton
              variante={reimprimirPrimero ? "primario" : "contorno"}
              icono={<Printer size={18} strokeWidth={2} />}
              onClick={() => guardar(true)}
              disabled={guardando}
            >
              Guardar y reimprimir recibo
            </Boton>
          </div>
        </div>
      )}

      <VentanaError mensaje={error} onCerrar={() => setError(null)} />
    </div>
  );
}
