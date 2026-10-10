"use client";

/**
 * La ficha de una empresa para el superadmin: corregir sus datos,
 * llevar las fechas del servicio (registrar pagos de N meses o ajustar
 * las fechas a mano), administrar los correos y contraseñas de sus
 * usuarios, y editar o eliminar sus sedes. Eliminar una sede
 * sigue la misma regla que /sedes dentro de la empresa: solo si no
 * tiene historial y nunca la única.
 */
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Building2, Check, Pencil, Trash2, Wallet } from "lucide-react";
import { Boton, BotonEnlace } from "@/componentes/ui/boton";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { UsuariosEmpresa } from "@/componentes/superadmin/usuarios-empresa";
import {
  estadoServicio,
  formatearFecha,
  hoyIso,
  inicioDelPago,
  sumarMeses,
  textoEstadoServicio,
  tonoServicio,
} from "@/lib/servicio-empresa";

interface Sede {
  id: string;
  nombre: string;
  tipo: "tienda" | "taller";
}

interface Pago {
  id: string;
  fecha_pago: string;
  meses: number;
  valor: number | null;
  desde: string;
  hasta: string;
  nota: string | null;
}

interface Empresa {
  id: string;
  nombre: string;
  nit: string | null;
  activa: boolean;
  servicio_inicio: string | null;
  servicio_fin: string | null;
  sedes: Sede[];
  pagos: Pago[];
}

const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

async function enviar(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
  return data;
}

export default function PaginaEmpresaSuperadmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Datos de la empresa
  const [nombre, setNombre] = useState("");
  const [nit, setNit] = useState("");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [guardandoDatos, setGuardandoDatos] = useState(false);

  // Pago
  const [meses, setMeses] = useState("1");
  const [valor, setValor] = useState("");
  const [nota, setNota] = useState("");
  const [registrando, setRegistrando] = useState(false);

  // Sedes
  const [editandoSede, setEditandoSede] = useState<string | null>(null);
  const [sedeNombre, setSedeNombre] = useState("");
  const [sedeTipo, setSedeTipo] = useState<"tienda" | "taller">("tienda");
  const [confirmandoSede, setConfirmandoSede] = useState<string | null>(null);
  const [procesandoSede, setProcesandoSede] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/superadmin/empresas/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cargar la empresa");
      setEmpresa(data);
      setNombre(data.nombre);
      setNit(data.nit ?? "");
      setInicio(data.servicio_inicio ?? "");
      setFin(data.servicio_fin ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la empresa");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoDatos(true);
    setError(null);
    setMensaje(null);
    try {
      await enviar(`/api/superadmin/empresas/${id}`, "PATCH", {
        nombre,
        nit,
        servicio_inicio: inicio || null,
        servicio_fin: fin || null,
      });
      setMensaje("Datos de la empresa guardados.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los datos");
    } finally {
      setGuardandoDatos(false);
    }
  }

  async function registrarPago(e: React.FormEvent) {
    e.preventDefault();
    setRegistrando(true);
    setError(null);
    setMensaje(null);
    try {
      const data = await enviar(`/api/superadmin/empresas/${id}/pagos`, "POST", {
        meses: Number(meses),
        valor: valor ? Number(valor) : null,
        nota: nota || null,
      });
      setMensaje(`Pago registrado. El servicio queda hasta el ${formatearFecha(data.hasta)}.`);
      setMeses("1");
      setValor("");
      setNota("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el pago");
    } finally {
      setRegistrando(false);
    }
  }

  async function guardarSede(sedeId: string) {
    setProcesandoSede(sedeId);
    setError(null);
    setMensaje(null);
    try {
      await enviar(`/api/superadmin/sedes/${sedeId}`, "PATCH", { nombre: sedeNombre, tipo: sedeTipo });
      setEditandoSede(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la sede");
    } finally {
      setProcesandoSede(null);
    }
  }

  async function eliminarSede(sedeId: string) {
    setProcesandoSede(sedeId);
    setError(null);
    setMensaje(null);
    try {
      await enviar(`/api/superadmin/sedes/${sedeId}`, "DELETE");
      setConfirmandoSede(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la sede");
    } finally {
      setProcesandoSede(null);
    }
  }

  if (cargando) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }
  if (!empresa) {
    return <Aviso tono="peligro">{error ?? "No se encontró la empresa."}</Aviso>;
  }

  const hoy = hoyIso();
  const servicio = estadoServicio(empresa.servicio_fin, hoy);
  const mesesNum = Number(meses);
  const desdePago = inicioDelPago(empresa.servicio_fin, hoy);
  const hastaPago = Number.isInteger(mesesNum) && mesesNum >= 1 && mesesNum <= 60 ? sumarMeses(desdePago, mesesNum) : null;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <BotonEnlace href="/superadmin/empresas" variante="fantasma" tamano="sm" icono={<ArrowLeft size={14} />}>
          Empresas
        </BotonEnlace>
      </div>
      <TituloPantalla
        icono={<Building2 size={24} strokeWidth={2} />}
        titulo={empresa.nombre}
        descripcion={empresa.activa ? "Activa" : "Suspendida: sus usuarios no ven nada hasta reactivarla."}
      />

      <div className="pila">
        {mensaje && (
          <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
            {mensaje}
          </Aviso>
        )}
        {error && <Aviso tono="peligro">{error}</Aviso>}
        <Tarjeta>
          <div className="fila" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700 }}>Servicio</span>
            <span className="cifra" style={{ color: "var(--ink-2)" }}>
              {formatearFecha(empresa.servicio_inicio)} → {formatearFecha(empresa.servicio_fin)}
            </span>
            <Etiqueta tono={tonoServicio(servicio)} punto>
              {textoEstadoServicio(servicio)}
            </Etiqueta>
          </div>
        </Tarjeta>

        <Tarjeta>
          <h2 style={{ marginBottom: 14 }}>Registrar pago</h2>
          <form onSubmit={registrarPago} className="pila" style={{ gap: 12, maxWidth: 520 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              <Campo etiqueta="Meses pagados">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={meses}
                  onChange={(e) => setMeses(e.target.value)}
                  className="cifra"
                />
              </Campo>
              <Campo etiqueta="Valor" ayuda="Opcional.">
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="cifra"
                />
              </Campo>
            </div>
            <Campo etiqueta="Nota" ayuda="Opcional. Ej. transferencia, efectivo, descuento.">
              <input value={nota} onChange={(e) => setNota(e.target.value)} />
            </Campo>
            {hastaPago && (
              <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                Cubre del <strong>{formatearFecha(desdePago)}</strong> al <strong>{formatearFecha(hastaPago)}</strong>
                {desdePago !== hoy && " (se suma al final porque el servicio sigue vigente)"}.
              </div>
            )}
            <div>
              <Boton
                type="submit"
                variante="primario"
                icono={<Wallet size={17} strokeWidth={2.2} />}
                disabled={registrando || !hastaPago}
              >
                {registrando ? "Registrando…" : "Registrar pago"}
              </Boton>
            </div>
          </form>

          {empresa.pagos.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <TarjetaTabla>
                <table>
                  <thead>
                    <tr>
                      <th>Pagó</th>
                      <th>Meses</th>
                      <th>Cubre</th>
                      <th>Valor</th>
                      <th>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empresa.pagos.map((p) => (
                      <tr key={p.id}>
                        <td className="cifra">{formatearFecha(p.fecha_pago)}</td>
                        <td className="cifra">{p.meses}</td>
                        <td className="cifra">
                          {formatearFecha(p.desde)} → {formatearFecha(p.hasta)}
                        </td>
                        <td className="cifra">{p.valor != null ? pesos.format(Number(p.valor)) : "—"}</td>
                        <td style={{ color: "var(--ink-2)" }}>{p.nota ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TarjetaTabla>
            </div>
          )}
        </Tarjeta>

        <Tarjeta>
          <h2 style={{ marginBottom: 14 }}>Datos de la empresa</h2>
          <form onSubmit={guardarDatos} className="pila" style={{ gap: 12, maxWidth: 520 }}>
            <Campo etiqueta="Nombre">
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Campo>
            <Campo etiqueta="NIT" ayuda="Opcional.">
              <input value={nit} onChange={(e) => setNit(e.target.value)} className="cifra" />
            </Campo>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <Campo etiqueta="Inicio del servicio">
                <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </Campo>
              <Campo etiqueta="Fin del servicio" ayuda="Para corregir a mano. Un pago la corre solo.">
                <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
              </Campo>
            </div>
            <div>
              <Boton
                type="submit"
                variante="primario"
                icono={<Check size={17} strokeWidth={2.2} />}
                disabled={guardandoDatos || !nombre.trim()}
              >
                {guardandoDatos ? "Guardando…" : "Guardar datos"}
              </Boton>
            </div>
          </form>
        </Tarjeta>

        <UsuariosEmpresa empresaId={empresa.id} />

        <Tarjeta>
          <h2 style={{ marginBottom: 6 }}>Sedes</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ink-3)" }}>
            Solo se puede eliminar una sede que nunca se usó (sin órdenes, ventas, inventario…), y nunca la única.
          </p>
          <div className="pila" style={{ gap: 10 }}>
            {empresa.sedes.map((s) => (
              <div
                key={s.id}
                className="fila"
                style={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                {editandoSede === s.id ? (
                  <form
                    className="fila"
                    style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      guardarSede(s.id);
                    }}
                  >
                    <input value={sedeNombre} onChange={(e) => setSedeNombre(e.target.value)} style={{ minWidth: 180 }} />
                    <select value={sedeTipo} onChange={(e) => setSedeTipo(e.target.value as "tienda" | "taller")}>
                      <option value="tienda">Tienda</option>
                      <option value="taller">Taller</option>
                    </select>
                    <Boton
                      type="submit"
                      variante="primario"
                      tamano="sm"
                      disabled={!sedeNombre.trim() || procesandoSede === s.id}
                    >
                      {procesandoSede === s.id ? "Guardando…" : "Guardar"}
                    </Boton>
                    <Boton variante="fantasma" tamano="sm" onClick={() => setEditandoSede(null)}>
                      Cancelar
                    </Boton>
                  </form>
                ) : (
                  <div className="fila" style={{ gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 700 }}>{s.nombre}</span>
                    <Etiqueta tono="neutro">{s.tipo}</Etiqueta>
                  </div>
                )}

                {editandoSede !== s.id &&
                  (confirmandoSede === s.id ? (
                    <div className="fila" style={{ gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                        ¿Eliminar <strong>{s.nombre}</strong>?
                      </span>
                      <Boton
                        variante="peligro"
                        tamano="sm"
                        onClick={() => eliminarSede(s.id)}
                        disabled={procesandoSede === s.id}
                      >
                        {procesandoSede === s.id ? "Eliminando…" : "Sí, eliminar"}
                      </Boton>
                      <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmandoSede(null)}>
                        Cancelar
                      </Boton>
                    </div>
                  ) : (
                    <div className="fila" style={{ gap: 6 }}>
                      <Boton
                        variante="fantasma"
                        tamano="sm"
                        icono={<Pencil size={14} strokeWidth={2} />}
                        onClick={() => {
                          setEditandoSede(s.id);
                          setSedeNombre(s.nombre);
                          setSedeTipo(s.tipo);
                          setConfirmandoSede(null);
                        }}
                      >
                        Editar
                      </Boton>
                      {empresa.sedes.length > 1 && (
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          icono={<Trash2 size={14} strokeWidth={2} />}
                          onClick={() => setConfirmandoSede(s.id)}
                        >
                          Eliminar
                        </Boton>
                      )}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </Tarjeta>

      </div>
    </div>
  );
}
