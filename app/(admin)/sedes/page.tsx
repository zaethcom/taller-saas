"use client";

/**
 * Alta de sedes: sin esto, una empresa que nace con una sola sede
 * (el superadmin solo crea una al dar de alta la empresa) no tiene
 * manera de abrir una segunda para poder trasladar mercancía entre
 * ellas -- /traslados ya asume que existen, solo no había dónde
 * crearlas.
 */
import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface Sede {
  id: string;
  nombre: string;
  tipo: "tienda" | "taller";
}

export default function PaginaSedes() {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<"tienda" | "taller">("tienda");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      const res = await fetch("/api/sedes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar las sedes");
      setSedes(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las sedes");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear() {
    if (!nombre.trim()) return;
    setError(null);
    setCreando(true);
    try {
      const res = await fetch("/api/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), tipo }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNombre("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la sede");
    } finally {
      setCreando(false);
    }
  }

  return (
    <div>
      <TituloPantalla
        icono={<Building2 size={24} strokeWidth={2} />}
        titulo="Sedes"
        descripcion="Cada local o taller de la empresa. Hacen falta al menos dos para poder trasladar mercancía entre ellas."
      />

      <div className="pila">
        <Tarjeta>
          {sedes.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Todavía no hay sedes.</p>
          ) : (
            <div className="fila" style={{ gap: 8 }}>
              {sedes.map((s) => (
                <Etiqueta key={s.id} tono="neutro">
                  {s.nombre} · {s.tipo}
                </Etiqueta>
              ))}
            </div>
          )}
        </Tarjeta>

        <Tarjeta>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crear();
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <Campo etiqueta="Nombre de la sede">
                <input
                  placeholder="Ej. Local 2, CD2, Taller Norte…"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </Campo>
              <Campo etiqueta="Tipo">
                <select value={tipo} onChange={(e) => setTipo(e.target.value as "tienda" | "taller")}>
                  <option value="tienda">Tienda</option>
                  <option value="taller">Taller</option>
                </select>
              </Campo>
            </div>
            <Boton
              type="submit"
              variante="primario"
              icono={<Plus size={17} strokeWidth={2.2} />}
              disabled={!nombre.trim() || creando}
              style={{ marginTop: 12 }}
            >
              Agregar sede
            </Boton>
          </form>
        </Tarjeta>

        {error && <Aviso tono="peligro">{error}</Aviso>}
      </div>
    </div>
  );
}
