"use client";

/**
 * Alta y administración de empresas de la plataforma. Crear una arma,
 * en un solo paso, la empresa + su primera sede + su primer usuario
 * admin (vía Auth Admin API) -- sin eso, nadie de esa empresa podría
 * entrar a terminar de configurarla. Suspender es reversible y de
 * efecto inmediato: empresa.activa gobierna empresa_actual() (0020),
 * así que una empresa suspendida deja de ver sus propios datos en toda
 * la aplicación, no solo aquí.
 */
import { useEffect, useState } from "react";
import { Building2, Plus, Check } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface Empresa {
  id: string;
  nombre: string;
  nit: string | null;
  activa: boolean;
  creada_en: string;
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
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setMensaje(`Empresa "${data.empresa.nombre}" creada. Admin: ${data.admin.correo}`);
      setNombreEmpresa("");
      setNit("");
      setNombreSede("");
      setAdminNombre("");
      setAdminCorreo("");
      setAdminClave("");
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
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 700 }}>{e.nombre}</td>
                    <td className="cifra" style={{ color: "var(--ink-2)" }}>
                      {e.nit ?? "—"}
                    </td>
                    <td className="cifra">{e.usuarios}</td>
                    <td className="cifra">{e.sedes}</td>
                    <td>
                      <Etiqueta tono={e.activa ? "ok" : "peligro"} punto>
                        {e.activa ? "Activa" : "Suspendida"}
                      </Etiqueta>
                    </td>
                    <td style={{ textAlign: "right" }}>
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
