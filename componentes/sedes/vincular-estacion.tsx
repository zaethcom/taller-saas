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
 *
 * La línea de estado se ve siempre, sin abrir nada: "en línea", "sin
 * conexión desde…" o "sin vincular", con los trabajos que esperan. Es lo
 * primero que hay que mirar cuando una sede dice que no le imprime.
 */
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Copy, Check, X, AlertTriangle, Download, Smartphone } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { configEstacion, estadoConexion } from "@/lib/estacion-estado";

interface Estado {
  vinculada: boolean;
  nombre?: string | null;
  creadaEn?: string;
  ultimoContactoEn?: string | null;
  pendientes?: number;
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

/** La línea que se ve siempre debajo de las impresoras de la sede. */
function LineaEstado({ estado }: { estado: Estado }) {
  const conexion = estado.vinculada ? estadoConexion(estado.ultimoContactoEn) : null;
  const pendientes = estado.pendientes ?? 0;
  return (
    <div className="fila" style={{ gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
      <span style={{ color: "var(--ink-2)" }}>Estación de impresión:</span>
      {!estado.vinculada ? (
        <Etiqueta tono="neutro">Sin vincular</Etiqueta>
      ) : conexion === "en_linea" ? (
        <Etiqueta tono="ok">En línea</Etiqueta>
      ) : conexion === "sin_conexion" && estado.ultimoContactoEn ? (
        <Etiqueta tono="peligro">Sin conexión desde {fechaHora(estado.ultimoContactoEn)}</Etiqueta>
      ) : (
        <Etiqueta tono="aviso">Vinculada, todavía no se ha conectado</Etiqueta>
      )}
      {pendientes > 0 && (
        <span style={{ color: "var(--ink-3)" }}>
          {pendientes === 1 ? "1 impresión esperando" : `${pendientes} impresiones esperando`}
        </span>
      )}
    </div>
  );
}

export function VincularEstacion({ sedeId }: { sedeId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [descargado, setDescargado] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<{ codigo: string; expiraEn: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/sedes/${sedeId}/estacion`);
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error);
      setEstado(cuerpo as Estado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar la estación");
    } finally {
      setCargando(false);
    }
  }, [sedeId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Mientras el código está en pantalla, se mira cada 5 s si la app ya lo
  // canjeó: así la pantalla dice «En línea» sola, sin recargar.
  useEffect(() => {
    if (!codigo) return;
    const t = setInterval(cargar, 5000);
    return () => clearInterval(t);
  }, [codigo, cargar]);

  async function pedirCodigo() {
    setProcesando(true);
    setError(null);
    try {
      const res = await fetch(`/api/sedes/${sedeId}/estacion/codigo`, { method: "POST" });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error);
      setCodigo(cuerpo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el código");
    } finally {
      setProcesando(false);
    }
  }

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
      setEstado({
        vinculada: true,
        nombre: nombre.trim() || null,
        creadaEn: new Date().toISOString(),
        ultimoContactoEn: null,
        pendientes: estado?.pendientes ?? 0,
      });
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
      setEstado({ vinculada: false, pendientes: estado?.pendientes ?? 0 });
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

  /**
   * El config.json listo para la estación: con esto en la carpeta
   * estacion/ del aparato, `npm start` ya imprime. apiBase sale de la
   * página donde se generó, así que apunta al mismo despliegue que se
   * está usando.
   */
  function descargarConfig() {
    if (!clave) return;
    const contenido = JSON.stringify(
      configEstacion({ sedeId, apiBase: window.location.origin, clave }),
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([contenido + "\n"], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "config.json";
    a.click();
    URL.revokeObjectURL(url);
    setDescargado(true);
  }

  function cerrar() {
    setAbierto(false);
    setClave(null);
    setCopiada(false);
    setDescargado(false);
    setCodigo(null);
    setNombre("");
    cargar();
    setError(null);
  }

  if (!abierto) {
    return (
      <div className="pila" style={{ gap: 6, marginTop: 10 }}>
        {estado && <LineaEstado estado={estado} />}
        {error && <Aviso tono="peligro">{error}</Aviso>}
        <div>
          <Boton
            variante="fantasma"
            tamano="sm"
            icono={<KeyRound size={14} strokeWidth={2} />}
            onClick={() => setAbierto(true)}
          >
            {estado?.vinculada ? "Estación de impresión" : "Vincular estación de impresión"}
          </Boton>
        </div>
      </div>
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

      {cargando && !estado ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Cargando…</p>
      ) : codigo ? (
        <div className="pila" style={{ gap: 12 }}>
          {estado && <LineaEstado estado={estado} />}
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
            Escribe este código en la app <strong>Puente de impresión</strong> del Android, en
            «Vincular con la página», o en la página <strong>/estacion</strong> de Chrome:
          </p>
          <div
            className="cifra"
            style={{
              padding: "14px 12px",
              background: "var(--surface-2)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-md)",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 4,
              textAlign: "center",
              userSelect: "all",
            }}
          >
            {codigo.codigo}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
            Sirve una sola vez y vence a las{" "}
            {new Date(codigo.expiraEn).toLocaleTimeString("es-CO", { timeStyle: "short" })}. Si la
            sede ya tenía una estación vinculada, deja de servir cuando la app use este código.
          </p>
        </div>
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
          <div className="fila" style={{ gap: 8, flexWrap: "wrap" }}>
            <Boton
              variante={descargado ? "contorno" : "primario"}
              tamano="sm"
              icono={descargado ? <Check size={15} strokeWidth={2.2} /> : <Download size={15} strokeWidth={2} />}
              onClick={descargarConfig}
            >
              {descargado ? "config.json descargado" : "Descargar config.json"}
            </Boton>
            <Boton
              variante="contorno"
              tamano="sm"
              icono={copiada ? <Check size={15} strokeWidth={2.2} /> : <Copy size={15} strokeWidth={2} />}
              onClick={copiar}
            >
              {copiada ? "Copiada" : "Copiar solo la clave"}
            </Boton>
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ink-2)" }}>
            <li>
              Pon el <code>config.json</code> descargado en la carpeta <code>estacion/</code> del
              equipo de la sede (reemplaza el que haya).
            </li>
            <li>
              Reinicia la estación (<code>npm start</code>). Las impresoras las toma de lo que
              configuraste arriba en esta sede.
            </li>
            <li>Vuelve aquí: en menos de un minuto debe decir «En línea».</li>
          </ol>
        </div>
      ) : (
        <div className="pila" style={{ gap: 12 }}>
          {estado && <LineaEstado estado={estado} />}
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

          <div className="fila" style={{ gap: 8, flexWrap: "wrap" }}>
            <Boton
              variante="primario"
              tamano="sm"
              icono={<KeyRound size={15} strokeWidth={2} />}
              onClick={generar}
              disabled={procesando}
            >
              {estado?.vinculada ? "Generar otra clave" : "Generar clave"}
            </Boton>
            <Boton
              variante="contorno"
              tamano="sm"
              icono={<Smartphone size={15} strokeWidth={2} />}
              onClick={pedirCodigo}
              disabled={procesando}
            >
              Código para la app Android
            </Boton>
            {estado?.vinculada && (
              <Boton variante="contorno" tamano="sm" onClick={revocar} disabled={procesando}>
                Revocar
              </Boton>
            )}
          </div>

          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
            «Generar clave» es para una estación en un computador (descarga un config.json).
            «Código para la app Android» es para que el Android del puente imprima solo, sin computador.
            El mismo código sirve en un Chromebook o cualquier equipo con Chrome y las impresoras por
            USB: abre <a href="/estacion" target="_blank" rel="noreferrer">/estacion</a> en ese equipo.
          </p>

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
