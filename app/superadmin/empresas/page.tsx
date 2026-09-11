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
    const res = await fetch("/api/superadmin/empresas");
    setEmpresas(await res.json());
    setCargando(false);
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

  if (cargando) return <p>Cargando…</p>;

  return (
    <div>
      <h1>Empresas</h1>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
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
            <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{e.nombre}</td>
              <td>{e.nit ?? "—"}</td>
              <td>{e.usuarios}</td>
              <td>{e.sedes}</td>
              <td style={{ color: e.activa ? "#2e7d32" : "#c0392b", fontWeight: 700 }}>
                {e.activa ? "Activa" : "Suspendida"}
              </td>
              <td>
                <button onClick={() => alternarActiva(e)} disabled={procesando === e.id}>
                  {e.activa ? "Suspender" : "Reactivar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {empresas.length === 0 && <p style={{ opacity: 0.6 }}>Todavía no hay empresas.</p>}

      <h2 style={{ fontSize: 16 }}>Crear empresa nueva</h2>
      <form onSubmit={crearEmpresa} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
        <input
          placeholder="Nombre de la empresa"
          value={nombreEmpresa}
          onChange={(e) => setNombreEmpresa(e.target.value)}
          style={{ padding: 8 }}
        />
        <input placeholder="NIT (opcional)" value={nit} onChange={(e) => setNit(e.target.value)} style={{ padding: 8 }} />
        <input
          placeholder="Nombre de la primera sede"
          value={nombreSede}
          onChange={(e) => setNombreSede(e.target.value)}
          style={{ padding: 8 }}
        />
        <hr style={{ border: "none", borderTop: "1px solid #223038", margin: "8px 0" }} />
        <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>Primer usuario administrador de la empresa:</p>
        <input
          placeholder="Nombre del admin"
          value={adminNombre}
          onChange={(e) => setAdminNombre(e.target.value)}
          style={{ padding: 8 }}
        />
        <input
          type="email"
          placeholder="Correo del admin"
          value={adminCorreo}
          onChange={(e) => setAdminCorreo(e.target.value)}
          style={{ padding: 8 }}
        />
        <input
          type="password"
          placeholder="Contraseña inicial (mín. 8 caracteres)"
          value={adminClave}
          onChange={(e) => setAdminClave(e.target.value)}
          style={{ padding: 8 }}
        />
        <button
          type="submit"
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
        </button>
      </form>

      {mensaje && <p style={{ color: "#4ade80", marginTop: 12 }}>{mensaje}</p>}
      {error && <p style={{ color: "#ff8080", marginTop: 12 }}>{error}</p>}
    </div>
  );
}
