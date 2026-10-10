"use client";

/**
 * Alta y administración de empresas de la plataforma. Crear una arma,
 * en un solo paso, la empresa + su primera sede + su primer usuario
 * admin (vía Auth Admin API) -- sin eso, nadie de esa empresa podría
 * entrar a terminar de configurarla. Suspender es reversible y de
 * efecto inmediato: empresa.activa gobierna empresa_actual() (0020),
 * así que una empresa suspendida deja de ver sus propios datos en toda
 * la aplicación, no solo aquí.
 *
 * Cada empresa muestra hasta cuándo tiene pago el servicio (0052) y el
 * listado avisa arriba de las vencidas y de las que vencen en los
 * próximos días. Vencer no suspende nada solo: suspender sigue siendo
 * decisión de quien está aquí. Editar la empresa, registrar pagos y
 * editar o eliminar sus sedes se hace en /superadmin/empresas/<id>.
 */
import { useEffect, useState } from "react";
import { Building2, Plus, Check, AlertTriangle, Settings2 } from "lucide-react";
import { Boton, BotonEnlace } from "@/componentes/ui/boton";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import {
  DIAS_AVISO,
  estadoServicio,
  formatearFecha,
  hoyIso,
  textoEstadoServicio,
  tonoServicio,
} from "@/lib/servicio-empresa";

interface Empresa {
  id: string;
  nombre: string;
  nit: string | null;
  activa: boolean;
  creada_en: string;
  servicio_inicio: string | null;
  servicio_fin: string | null;
  usuarios: number;
  sedes: number;
}

export default function PaginaSuperadminEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [nit, setNit] = useState("");
  const [nombreSede, setNombreSede] = useState("");
  const [adminNombre, setAdminNombre] = useState("");
  const [adminCorreo, setAdminCorreo] = useState("");
  const [adminClave, setAdminClave] = useState("");
  const [mesesPagados, setMesesPagados] = useState("");
  const [valorPagado, setValorPagado] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/superadmin/empresas");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar las empresas");
      setEmpresas(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las empresas");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crearEmpresa(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch("/api/superadmin/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreEmpresa: nombreEmpresa.trim(),
          nit: nit.trim() || undefined,
          nombreSede: nombreSede.trim(),
          adminNombre: adminNombre.trim(),
          adminCorreo: adminCorreo.trim(),
          adminClave,
          mesesPagados: mesesPagados ? Number(mesesPagados) : undefined,
          valorPagado: valorPagado ? Number(valorPagado) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setMensaje(`Empresa "${data.empresa.nombre}" creada. Admin: ${data.admin.correo}`);
      if (data.avisoPago) setError(data.avisoPago);
      setNombreEmpresa("");
      setNit("");
      setNombreSede("");
      setAdminNombre("");
      setAdminCorreo("");
      setAdminClave("");
      setMesesPagados("");
      setValorPagado("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la empresa");
    } finally {
      setCreando(false);
    }
  }

  async function alternarActiva(emp: Empresa) {
    setProcesando(emp.id);
    try {
      await fetch(`/api/superadmin/empresas/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa: !emp.activa }),
      });
      await cargar();
    } finally {
      setProcesando(null);
    }
  }

  const hoy = hoyIso();
  const conEstado = empresas.map((e) => ({ ...e, servicio: estadoServicio(e.servicio_fin, hoy) }));
  const vencidas = conEstado.filter((e) => e.servicio.tipo === "vencido");
  const porVencer = conEstado.filter((e) => e.servicio.tipo === "por_vencer");

  if (cargando) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  return (
    <div>
      <TituloPantalla
        icono={<Building2 size={24} strokeWidth={2} />}
        titulo="Empresas"
        descripcion="Suspender es inmediato y reversible: la empresa deja de ver sus datos en toda la aplicación."
      />

      <div className="pila">
        {(vencidas.length > 0 || porVencer.length > 0) && (
          <Aviso tono={vencidas.length > 0 ? "peligro" : "aviso"} icono={<AlertTriangle size={17} strokeWidth={2.2} />}>
            {vencidas.length > 0 && (
              <div>
                <strong>Vencidas:</strong>{" "}
                {vencidas.map((e) => `${e.nombre} (${formatearFecha(e.servicio_fin)})`).join(", ")}
              </div>
            )}
            {porVencer.length > 0 && (
              <div>
                <strong>Vencen en los próximos {DIAS_AVISO} días:</strong>{" "}
                {porVencer.map((e) => `${e.nombre} (${formatearFecha(e.servicio_fin)})`).join(", ")}
              </div>
            )}
          </Aviso>
        )}

        {empresas.length === 0 ? (
          <Tarjeta style={{ borderStyle: "dashed", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
            Todavía no hay empresas.
          </Tarjeta>
        ) : (
          <TarjetaTabla>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>NIT</th>
                  <th>Usuarios</th>
                  <th>Sedes</th>
                  <th>Servicio hasta</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {conEstado.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 700 }}>{e.nombre}</td>
                    <td className="cifra" style={{ color: "var(--ink-2)" }}>
                      {e.nit ?? "—"}
                    </td>
                    <td className="cifra">{e.usuarios}</td>
                    <td className="cifra">{e.sedes}</td>
                    <td>
                      <div className="cifra" style={{ fontSize: 13 }}>
                        {formatearFecha(e.servicio_fin)}
                      </div>
                      <Etiqueta tono={tonoServicio(e.servicio)}>{textoEstadoServicio(e.servicio)}</Etiqueta>
                    </td>
                    <td>
                      <Etiqueta tono={e.activa ? "ok" : "peligro"} punto>
                        {e.activa ? "Activa" : "Suspendida"}
                      </Etiqueta>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <BotonEnlace
                        href={`/superadmin/empresas/${e.id}`}
                        variante="fantasma"
                        tamano="sm"
                        icono={<Settings2 size={14} strokeWidth={2} />}
                        style={{ marginRight: 6 }}
                      >
                        Administrar
                      </BotonEnlace>
                      <Boton
                        variante={e.activa ? "peligro" : "primario"}
                        tamano="sm"
                        onClick={() => alternarActiva(e)}
                        disabled={procesando === e.id}
                      >
                        {e.activa ? "Suspender" : "Reactivar"}
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TarjetaTabla>
        )}

        <Tarjeta>
          <h2 style={{ marginBottom: 14 }}>Crear empresa nueva</h2>
          <form onSubmit={crearEmpresa} className="pila" style={{ gap: 12, maxWidth: 480 }}>
            <Campo etiqueta="Nombre de la empresa">
              <input
                placeholder="Ej. Team Polaco Scooter"
                value={nombreEmpresa}
                onChange={(e) => setNombreEmpresa(e.target.value)}
              />
            </Campo>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <Campo etiqueta="NIT" ayuda="Opcional.">
                <input placeholder="Opcional" value={nit} onChange={(e) => setNit(e.target.value)} className="cifra" />
              </Campo>
              <Campo etiqueta="Primera sede">
                <input placeholder="Ej. Principal" value={nombreSede} onChange={(e) => setNombreSede(e.target.value)} />
              </Campo>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <Campo etiqueta="Meses pagados" ayuda="Opcional. El servicio corre desde hoy.">
                <input
                  type="number"
                  min={1}
                  max={60}
                  placeholder="Ej. 6"
                  value={mesesPagados}
                  onChange={(e) => setMesesPagados(e.target.value)}
                  className="cifra"
                />
              </Campo>
              <Campo etiqueta="Valor pagado" ayuda="Opcional.">
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={valorPagado}
                  onChange={(e) => setValorPagado(e.target.value)}
                  className="cifra"
                  disabled={!mesesPagados}
                />
              </Campo>
            </div>

            <div style={{ height: 1, background: "var(--rule)", margin: "4px 0" }} />
            <div className="campo-etiqueta" style={{ margin: 0 }}>
              Primer usuario administrador de la empresa
            </div>

            <Campo etiqueta="Nombre del admin">
              <input placeholder="Nombre y apellido" value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} />
            </Campo>
            <Campo etiqueta="Correo del admin">
              <input
                type="email"
                placeholder="admin@empresa.com"
                value={adminCorreo}
                onChange={(e) => setAdminCorreo(e.target.value)}
                autoComplete="off"
              />
            </Campo>
            <Campo
              etiqueta="Contraseña inicial"
              ayuda="Mínimo 8 caracteres. Quien la reciba debería cambiarla al entrar."
              error={adminClave.length > 0 && adminClave.length < 8 ? "Faltan caracteres." : null}
            >
              <input
                type="password"
                placeholder="••••••••"
                value={adminClave}
                onChange={(e) => setAdminClave(e.target.value)}
                autoComplete="new-password"
              />
            </Campo>

            <div>
              <Boton
                type="submit"
                variante="primario"
                tamano="lg"
                icono={<Plus size={19} strokeWidth={2.2} />}
                disabled={
                  creando ||
                  !nombreEmpresa.trim() ||
                  !nombreSede.trim() ||
                  !adminNombre.trim() ||
                  !adminCorreo.trim() ||
                  adminClave.length < 8
                }
              >
                {creando ? "Creando…" : "Crear empresa"}
              </Boton>
            </div>
          </form>
        </Tarjeta>

        {mensaje && (
          <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
            {mensaje}
          </Aviso>
        )}
        {error && <Aviso tono="peligro">{error}</Aviso>}
      </div>
    </div>
  );
}
