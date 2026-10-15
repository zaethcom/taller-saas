"use client";

/**
 * Los usuarios de una empresa vistos desde el superadmin: con qué correo
 * entra cada uno, y la manera de cambiarle el correo o la contraseña, o
 * de crearle otro administrador. La contraseña actual no se muestra
 * porque no se puede: Auth solo guarda su hash.
 */
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, UserCog } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";

interface Usuario {
  id: string;
  nombre: string;
  rol: string;
  correo: string | null;
}

async function enviar(url: string, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
  return data;
}

export function UsuariosEmpresa({ empresaId }: { empresaId: string }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [editando, setEditando] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoCorreo, setNuevoCorreo] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/superadmin/empresas/${empresaId}/usuarios`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar los usuarios");
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los usuarios");
    } finally {
      setCargando(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function empezarEdicion(u: Usuario) {
    setEditando(u.id);
    setNombre(u.nombre);
    setCorreo(u.correo ?? "");
    setClave("");
    setError(null);
    setMensaje(null);
  }

  async function guardar(u: Usuario) {
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const cambios: Record<string, string> = {};
      if (nombre.trim() !== u.nombre) cambios.nombre = nombre;
      if (correo.trim() !== (u.correo ?? "")) cambios.correo = correo;
      if (clave) cambios.clave = clave;
      if (Object.keys(cambios).length === 0) {
        setEditando(null);
        return;
      }
      await enviar(`/api/superadmin/usuarios/${u.id}`, "PATCH", cambios);
      setMensaje(
        clave
          ? `Guardado. ${nombre.trim()} ya entra con ${correo.trim()} y la contraseña nueva.`
          : `Guardado. ${nombre.trim()} entra con ${correo.trim()}.`,
      );
      setEditando(null);
      setClave("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el usuario");
    } finally {
      setGuardando(false);
    }
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      await enviar(`/api/superadmin/empresas/${empresaId}/usuarios`, "POST", {
        nombre: nuevoNombre.trim(),
        correo: nuevoCorreo.trim(),
        clave: nuevaClave,
      });
      setMensaje(`Administrador creado. Entra con ${nuevoCorreo.trim()}.`);
      setCreando(false);
      setNuevoNombre("");
      setNuevoCorreo("");
      setNuevaClave("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el administrador");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <h2 style={{ marginBottom: 6 }}>Usuarios y accesos</h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ink-3)" }}>
        El correo es el usuario con el que se inicia sesión. La contraseña actual no se puede ver; aquí se pone una
        nueva.
      </p>

      {cargando ? (
        <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Cargando…</div>
      ) : (
        <div className="pila" style={{ gap: 10 }}>
          {usuarios.length === 0 && (
            <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Esta empresa no tiene usuarios activos.</div>
          )}
          {usuarios.map((u) => (
            <div key={u.id} style={{ paddingBottom: 10, borderBottom: "1px solid var(--rule)" }}>
              {editando === u.id ? (
                <form
                  className="pila"
                  style={{ gap: 10, maxWidth: 520 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    guardar(u);
                  }}
                >
                  <Campo etiqueta="Nombre">
                    <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  </Campo>
                  <Campo etiqueta="Correo (usuario)">
                    <input
                      type="email"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      autoComplete="off"
                    />
                  </Campo>
                  <Campo
                    etiqueta="Contraseña nueva"
                    ayuda="Déjala vacía para no cambiarla. Mínimo 8 caracteres."
                    error={clave.length > 0 && clave.length < 8 ? "Faltan caracteres." : null}
                  >
                    <input
                      type="text"
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Sin cambios"
                    />
                  </Campo>
                  <div className="fila" style={{ gap: 8 }}>
                    <Boton
                      type="submit"
                      variante="primario"
                      tamano="sm"
                      disabled={
                        guardando || !nombre.trim() || !correo.trim() || (clave.length > 0 && clave.length < 8)
                      }
                    >
                      {guardando ? "Guardando…" : "Guardar"}
                    </Boton>
                    <Boton variante="fantasma" tamano="sm" onClick={() => setEditando(null)}>
                      Cancelar
                    </Boton>
                  </div>
                </form>
              ) : (
                <div
                  className="fila"
                  style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                >
                  <div>
                    <div className="fila" style={{ gap: 8, alignItems: "center" }}>
                      <span style={{ fontWeight: 700 }}>{u.nombre}</span>
                      <Etiqueta tono={u.rol === "admin" ? "info" : "neutro"}>{u.rol}</Etiqueta>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{u.correo ?? "Sin correo"}</div>
                  </div>
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    icono={<KeyRound size={14} strokeWidth={2} />}
                    onClick={() => empezarEdicion(u)}
                  >
                    Cambiar correo o contraseña
                  </Boton>
                </div>
              )}
            </div>
          ))}

          {creando ? (
            <form onSubmit={crear} className="pila" style={{ gap: 10, maxWidth: 520 }}>
              <div className="campo-etiqueta" style={{ margin: 0 }}>
                Administrador nuevo
              </div>
              <Campo etiqueta="Nombre">
                <input
                  placeholder="Nombre y apellido"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                />
              </Campo>
              <Campo etiqueta="Correo (usuario)">
                <input
                  type="email"
                  placeholder="admin@empresa.com"
                  value={nuevoCorreo}
                  onChange={(e) => setNuevoCorreo(e.target.value)}
                  autoComplete="off"
                />
              </Campo>
              <Campo
                etiqueta="Contraseña"
                ayuda="Mínimo 8 caracteres."
                error={nuevaClave.length > 0 && nuevaClave.length < 8 ? "Faltan caracteres." : null}
              >
                <input
                  type="text"
                  value={nuevaClave}
                  onChange={(e) => setNuevaClave(e.target.value)}
                  autoComplete="new-password"
                />
              </Campo>
              <div className="fila" style={{ gap: 8 }}>
                <Boton
                  type="submit"
                  variante="primario"
                  tamano="sm"
                  icono={<UserCog size={14} strokeWidth={2} />}
                  disabled={guardando || !nuevoNombre.trim() || !nuevoCorreo.trim() || nuevaClave.length < 8}
                >
                  {guardando ? "Creando…" : "Crear administrador"}
                </Boton>
                <Boton variante="fantasma" tamano="sm" onClick={() => setCreando(false)}>
                  Cancelar
                </Boton>
              </div>
            </form>
          ) : (
            <div>
              <Boton
                variante="contorno"
                tamano="sm"
                icono={<Plus size={14} strokeWidth={2.2} />}
                onClick={() => {
                  setCreando(true);
                  setEditando(null);
                  setError(null);
                  setMensaje(null);
                }}
              >
                Agregar administrador
              </Boton>
            </div>
          )}
        </div>
      )}

      {mensaje && (
        <div style={{ marginTop: 12 }}>
          <Aviso tono="ok">{mensaje}</Aviso>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 12 }}>
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}
    </Tarjeta>
  );
}
