"use client";

/**
 * Punto 5 del documento de requerimientos: crear y guardar usuarios
 * desde la administración, habilitados para las operaciones que les
 * correspondan (el rol elegido decide eso -- ver lib/permisos.ts).
 * Mismo patrón colapsado que FormularioRecepcion: esta pantalla se abre
 * sobre todo para mirar la lista, no para crear a cada rato.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import type { Rol } from "@/lib/permisos";

interface Sede {
  id: string;
  nombre: string;
}

const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: "admin", etiqueta: "Admin" },
  { valor: "recepcion", etiqueta: "Recepción" },
  { valor: "tecnico", etiqueta: "Técnico" },
  { valor: "compras", etiqueta: "Compras" },
  { valor: "cajero", etiqueta: "Cajero" },
];

export function NuevoUsuario() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [rol, setRol] = useState<Rol>("cajero");
  const [sedeId, setSedeId] = useState("");
  const [sedes, setSedes] = useState<Sede[]>([]);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    fetch("/api/sedes")
      .then((r) => r.json())
      .then((data) => setSedes(Array.isArray(data) ? data : []))
      .catch(() => setSedes([]));
  }, [abierto]);

  function limpiar() {
    setNombre("");
    setCorreo("");
    setClave("");
    setRol("cajero");
    setSedeId("");
    setError(null);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !correo.trim()) {
      setError("Falta el nombre o el correo");
      return;
    }
    if (clave.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          correo: correo.trim(),
          clave,
          rol,
          sedeId: sedeId || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      limpiar();
      setAbierto(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el usuario");
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <Boton
        variante="primario"
        icono={<UserPlus size={17} strokeWidth={2} />}
        onClick={() => setAbierto(true)}
        style={{ marginBottom: 18 }}
      >
        Nuevo usuario
      </Boton>
    );
  }

  return (
    <Tarjeta style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <UserPlus size={17} strokeWidth={2} />
          Nuevo usuario
        </div>
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={<X size={16} strokeWidth={2} />}
          onClick={() => {
            setAbierto(false);
            limpiar();
          }}
        />
      </div>

      <form onSubmit={crear} className="pila" style={{ gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <Campo etiqueta="Nombre">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </Campo>
          <Campo etiqueta="Correo">
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </Campo>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <Campo etiqueta="Contraseña" ayuda="Mínimo 8 caracteres.">
            <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} />
          </Campo>
          <Campo etiqueta="Rol">
            <select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <Campo etiqueta="Sede">
          <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            <option value="">Sin sede</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </Campo>

        {error && <Aviso tono="peligro">{error}</Aviso>}

        <div>
          <Boton type="submit" variante="primario" disabled={enviando}>
            {enviando ? "Creando…" : "Crear usuario"}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
