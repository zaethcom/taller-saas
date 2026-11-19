"use client";

/**
 * La orden en el celular del técnico sin internet (desde /escanear):
 * los datos que trae la copia local y el cambio de estado con una nota.
 * El cambio queda en la cola (lib/sin-conexion/cola.ts) y sube solo al
 * volver internet, por la misma ruta de la ficha
 * (/api/ordenes/[id]/transicion, con claveLocal para no repetirlo).
 *
 * Diagnóstico, cotización, repuestos y evidencia siguen pidiendo
 * internet: necesitan datos que la copia no trae y podrían pisar lo que
 * otro ya guardó.
 */
import { useState } from "react";
import { WifiOff, Check } from "lucide-react";
import { agregarACola, nuevaClaveLocal } from "@/lib/sin-conexion/cola";
import { guardarCopia, leerCopia } from "@/lib/sin-conexion/copia-local";
import { aplicarEstadoEnCopia, descripcionEstado, estadosSinConexion } from "@/lib/sin-conexion/orden-local";
import type { OrdenLocal } from "@/lib/sin-conexion/tipos";
import { esEstado, ETIQUETA_ESTADO, type Estado } from "@/lib/estados";
import { EstadoOrden } from "@/componentes/ui/estado-orden";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Aviso, Campo } from "@/componentes/ui/campo";
import { Boton } from "@/componentes/ui/boton";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export function FichaSinConexion({ orden: inicial, onVolver }: { orden: OrdenLocal; onVolver: () => void }) {
  const [orden, setOrden] = useState(inicial);
  const [destino, setDestino] = useState<Estado | null>(null);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "peligro"; texto: string } | null>(null);

  const opciones = estadosSinConexion(orden.estado);

  async function guardar() {
    if (!destino) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const copia = await leerCopia();
      if (!copia) throw new Error("Este equipo no tiene la copia de datos. Inténtalo cuando vuelva internet.");
      const ahora = new Date();
      const hora = ahora.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
      const texto = [nota.trim(), `(sin conexión, ${hora})`].filter(Boolean).join(" ");
      const clave = nuevaClaveLocal();
      const ok = await agregarACola({
        id: clave,
        tipo: "estado",
        creadoEn: ahora.toISOString(),
        empresaId: copia.empresaId,
        sedeId: copia.sedeId,
        usuarioId: copia.usuarioId,
        descripcion: descripcionEstado(orden.numero, ETIQUETA_ESTADO[destino]),
        url: `/api/ordenes/${orden.id}/transicion`,
        cuerpo: { aEstado: destino, nota: texto, claveLocal: clave },
      });
      if (!ok) throw new Error("No se pudo guardar en este equipo.");
      await guardarCopia(aplicarEstadoEnCopia(copia, orden.id, destino));
      setOrden({ ...orden, estado: destino });
      setMensaje({ tono: "ok", texto: `Guardado: ${ETIQUETA_ESTADO[destino]}. Se sube solo cuando vuelva internet.` });
      setDestino(null);
      setNota("");
    } catch (e) {
      setMensaje({ tono: "peligro", texto: e instanceof Error ? e.message : "No se pudo guardar." });
    } finally {
      setGuardando(false);
    }
  }

  const c = orden.cuenta;

  return (
    <div className="pila">
      <Aviso tono="aviso" icono={<WifiOff size={18} />}>
        Sin internet: ves la orden guardada en este equipo y puedes cambiar su estado. Diagnóstico, cotización, repuestos y fotos necesitan internet.
      </Aviso>

      <Tarjeta>
        <div className="fila" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div className="cifra" style={{ fontSize: 22, fontWeight: 800 }}>
            Orden #{orden.numero}
          </div>
          {esEstado(orden.estado) ? <EstadoOrden estado={orden.estado} /> : orden.estado}
        </div>
        <div style={{ fontWeight: 600 }}>{[orden.tipo, orden.marca, orden.modelo].filter(Boolean).join(" · ") || "Equipo"}</div>
        {orden.serial ? <div className="cifra" style={{ color: "var(--ink-2)" }}>Serial {orden.serial}</div> : null}
        {c?.motivo ? <p style={{ margin: "8px 0 0" }}>{c.motivo}</p> : null}
        {c?.clienteNombre ? (
          <div style={{ marginTop: 8, color: "var(--ink-2)" }}>
            {c.clienteNombre}
            {c.clienteTelefono ? ` · ${c.clienteTelefono}` : ""}
          </div>
        ) : null}
        {c && c.items.length > 0 ? (
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--ink-2)" }}>
            {c.items.map((i, n) => (
              <li key={n}>
                {i.cantidad} × {i.descripcion} · {fmt(i.precioUnit * i.cantidad)}
              </li>
            ))}
          </ul>
        ) : null}
        {c ? (
          <div className="cifra" style={{ marginTop: 8 }}>
            Saldo: <strong>{fmt(c.saldo)}</strong>
          </div>
        ) : null}
      </Tarjeta>

      {opciones.length > 0 && (
        <Tarjeta>
          <div className="campo-etiqueta" style={{ marginBottom: 8 }}>
            Cambiar estado
          </div>
          <div className="pila" style={{ gap: 8 }}>
            {opciones.map((e) => (
              <Boton
                key={e}
                variante={destino === e ? "primario" : "secundario"}
                tamano="lg"
                ancho
                icono={destino === e ? <Check size={18} /> : undefined}
                onClick={() => setDestino(e)}
                disabled={guardando}
              >
                {ETIQUETA_ESTADO[e]}
              </Boton>
            ))}
          </div>
          {destino && (
            <div style={{ marginTop: 12 }}>
              <Campo etiqueta="Nota (opcional)">
                <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={900} />
              </Campo>
              <div style={{ marginTop: 10 }}>
                <Boton variante="primario" tamano="lg" ancho onClick={guardar} disabled={guardando}>
                  {guardando ? "Guardando…" : `Guardar: ${ETIQUETA_ESTADO[destino]}`}
                </Boton>
              </div>
            </div>
          )}
        </Tarjeta>
      )}

      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

      <Boton variante="secundario" ancho onClick={onVolver}>
        Escanear otra orden
      </Boton>
    </div>
  );
}
