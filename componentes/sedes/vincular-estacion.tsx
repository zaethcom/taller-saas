"use client";

/**
 * Generar la credencial con la que la estación de impresión de esta sede
 * se autentica -- antes había que entrar a la base y hacer el INSERT a
 * mano, con el hash calculado aparte, así que dar de alta una sede nueva
 * no estaba al alcance de quien administra el negocio.
 *
 * La clave aparece UNA sola vez, al crearla: la tabla guarda solo su
 * hash. Por eso la pantalla insiste en copiarla antes de cerrar, y por
 * eso "Generar otra" dice en voz alta que la anterior deja de servir --
 * rotar sin avisar es dejar una sede sin imprimir a mitad de un día.
 */
import { useEffect, useState } from "react";
import { KeyRound, Copy, Check, X, AlertTriangle } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";

interface Estado {
  vinculada: boolean;
  nombre?: string | null;
  creadaEn?: string;
}

export function VincularEstacion({ sedeId }: { sedeId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    fetch(`/api/sedes/${sedeId}/estacion`)
      .then((r) => r.json())
      .then((d: Estado) => setEstado(d))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [abierto, sedeId]);

  async function generar() {
    setProcesando(true);
    setError(null);
    setCopiada(false);
    try {
      const res = await fetch(`/api/sedes/${sedeId}/estacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() || null }),
      });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error);
      setClave(cuerpo.clave);
      setEstado({ vinculada: true, nombre: nombre.trim() || null, creadaEn: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la credencial");
    } finally {
      setProcesando(false);
    }
  }

  async function revocar() {
    setProcesando(true);
    setError(null);
    try {
      const res = await fetch(`/api/sedes/${sedeId}/estacion`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setClave(null);
      setEstado({ vinculada: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo revocar");
    } finally {
      setProcesando(false);
    }
  }

  function copiar() {
    if (!clave) return;
    // Sin navigator.clipboard fuera de HTTPS: se selecciona a mano.
    navigator.clipboard?.writeText(clave).then(
      () => setCopiada(true),
      () => setError("El navegador no dejó copiar. Selecciona la clave y cópiala a mano."),
    );
  }

  function cerrar() {
    setAbierto(false);
    setClave(null);
    setCopiada(false);
    setNombre("");
    setError(null);
  }

  if (!abierto) {
    return (
      <Boton
        variante="fantasma"
        tamano="sm"
        icono={<KeyRound size={14} strokeWidth={2} />}
        onClick={() => setAbierto(true)}
        style={{ marginTop: 10 }}
      >
        Vincular estación de impresión
      </Boton>
    );
  }

  return (
    <Tarjeta style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <KeyRound size={16} strokeWidth={2} />
          Estación de impresión de esta sede
        </div>
        <Boton variante="fantasma" tamano="sm" icono={<X size={15} strokeWidth={2} />} onClick={cerrar} />
      </div>

      {cargando ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Cargando…</p>
      ) : clave ? (
        <div className="pila" style={{ gap: 12 }}>
          <Aviso tono="aviso" icono={<AlertTriangle size={16} strokeWidth={2} />}>
            <strong>Cópiala ahora.</strong> Es la única vez que se muestra: el sistema guarda
            solo una huella de la clave, no la clave. Si se pierde, hay que generar otra.
          </Aviso>
          <div
            className="cifra"
            style={{
              padding: "10px 12px",
              background: "var(--surface-2)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-md)",
              fontSize: 12,
              wordBreak: "break-all",
              userSelect: "all",
            }}
          >
            {clave}
          </div>
          <div>
            <Boton
              variante={copiada ? "contorno" : "primario"}
              tamano="sm"
              icono={copiada ? <Check size={15} strokeWidth={2.2} /> : <Copy size={15} strokeWidth={2} />}
              onClick={copiar}
            >
              {copiada ? "Copiada" : "Copiar clave"}
            </Boton>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-2)" }}>
            Va en el campo <code>servicioClave</code> del <code>config.json</code> de la estación.
          </p>
        </div>
      ) : (
        <div className="pila" style={{ gap: 12 }}>
          {estado?.vinculada ? (
            <Aviso tono="ok">
              Esta sede ya tiene una estación vinculada
              {estado.nombre ? ` («${estado.nombre}»)` : ""}
              {estado.creadaEn ? `, desde el ${new Date(estado.creadaEn).toLocaleDateString("es-CO")}` : ""}.
              Su clave no se puede volver a ver.
            </Aviso>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
              Esta sede todavía no tiene estación vinculada, así que nada de lo que se
              encole aquí va a imprimirse.
            </p>
          )}

          <Campo
            etiqueta="Cómo llamar a este equipo"
            ayuda="Solo para distinguirlo en esta pantalla. Por ejemplo: Tablet del mostrador."
          >
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tablet del mostrador" />
          </Campo>

          <div className="fila" style={{ gap: 8 }}>
            <Boton
              variante="primario"
              tamano="sm"
              icono={<KeyRound size={15} strokeWidth={2} />}
              onClick={generar}
              disabled={procesando}
            >
              {estado?.vinculada ? "Generar otra clave" : "Generar clave"}
            </Boton>
            {estado?.vinculada && (
              <Boton variante="contorno" tamano="sm" onClick={revocar} disabled={procesando}>
                Revocar
              </Boton>
            )}
          </div>

          {estado?.vinculada && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
              Generar otra <strong>deja de aceptar la actual</strong>: el equipo que la tenga
              puesta deja de imprimir hasta que le pongas la nueva.
            </p>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10 }}>
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}
    </Tarjeta>
  );
}
