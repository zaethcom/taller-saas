"use client";

/**
 * El admin sin internet (plan sin internet): el tablero de órdenes,
 * existencias y clientes se pueden consultar desde la copia local; las
 * demás pantallas del admin (configuración, catálogos, reportes...)
 * dicen que necesitan internet. Con internet muestra la pantalla de
 * siempre (children), tal cual la armó el servidor.
 *
 * Va en el layout del admin, así ninguna pantalla tiene que saberlo.
 */
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { WifiOff, Search } from "lucide-react";
import { leerCopia } from "@/lib/sin-conexion/copia-local";
import { suscribirCola } from "@/lib/sin-conexion/cola";
import { probarServidor, REINTENTO_SIN_CONEXION_MS } from "@/lib/sin-conexion/conexion";
import { clientesLocal, consultaDeRuta, existenciasLocal, ordenesLocal, MAXIMO_FILAS } from "@/lib/sin-conexion/consultas-local";
import type { CopiaLocal } from "@/lib/sin-conexion/tipos";
import { ETIQUETA_ESTADO, type Estado } from "@/lib/estados";
import { EstadoOrden } from "@/componentes/ui/estado-orden";
import { TarjetaTabla } from "@/componentes/ui/tarjeta";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { Aviso } from "@/componentes/ui/campo";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const hora = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** true cuando no hay internet: sin red, o con red que no llega al servidor. */
function useSinConexion(): boolean {
  const [sin, setSin] = useState(false);
  useEffect(() => {
    let cancelado = false;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    async function revisar() {
      clearTimeout(reloj);
      const ok = navigator.onLine ? await probarServidor() : false;
      if (cancelado) return;
      setSin(!ok);
      if (!ok) reloj = setTimeout(revisar, REINTENTO_SIN_CONEXION_MS);
    }
    if (!navigator.onLine) setSin(true);
    void revisar();
    const ahora = () => void revisar();
    window.addEventListener("online", ahora);
    window.addEventListener("offline", ahora);
    return () => {
      cancelado = true;
      clearTimeout(reloj);
      window.removeEventListener("online", ahora);
      window.removeEventListener("offline", ahora);
    };
  }, []);
  return sin;
}

export function ConsultaSinConexion({ children }: { children: React.ReactNode }) {
  const sinConexion = useSinConexion();
  const ruta = usePathname();
  const [copia, setCopia] = useState<CopiaLocal | null | undefined>(undefined);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    if (!sinConexion) return;
    let vivo = true;
    const cargar = () => void leerCopia().then((c) => vivo && setCopia(c));
    cargar();
    // Una recepción hecha sin conexión cambia la copia.
    const quitar = suscribirCola(cargar);
    return () => {
      vivo = false;
      quitar();
    };
  }, [sinConexion]);

  const consulta = consultaDeRuta(ruta);
  if (!sinConexion) return <>{children}</>;

  if (!consulta) {
    return (
      <div style={{ maxWidth: 520 }}>
        <TituloPantalla titulo="Sin conexión a internet" />
        <Aviso tono="aviso" icono={<WifiOff size={18} />}>
          Esta pantalla necesita internet. Sin conexión puedes consultar el <Link href="/ordenes">tablero de órdenes</Link>,{" "}
          <Link href="/inventario">existencias</Link> y <Link href="/clientes">clientes</Link>, y seguir trabajando en{" "}
          <Link href="/vender">Vender</Link>, <Link href="/recibir">Recibir</Link> y <Link href="/entregar">Cobrar y entregar</Link>.
        </Aviso>
      </div>
    );
  }

  const titulo = consulta === "ordenes" ? "Órdenes abiertas" : consulta === "existencias" ? "Existencias" : "Clientes";

  return (
    <div>
      <TituloPantalla titulo={titulo} />
      <div style={{ marginBottom: 12 }}>
        <Aviso tono="aviso" icono={<WifiOff size={18} />}>
          Sin internet: solo consulta, con los datos guardados en este equipo
          {copia ? ` (${hora(copia.generadaEn)})` : ""}. Para cambiar algo hace falta internet.
        </Aviso>
      </div>
      {copia === undefined ? null : copia === null ? (
        <p style={{ color: "var(--ink-3)" }}>Este equipo todavía no tiene datos guardados. Abre la app una vez con internet.</p>
      ) : (
        <>
          <label style={{ position: "relative", display: "block", maxWidth: 420, marginBottom: 12 }}>
            <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }} />
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={consulta === "ordenes" ? "Número, cliente, teléfono, serial..." : consulta === "existencias" ? "Código, nombre, marca..." : "Nombre, documento, teléfono..."}
              style={{ paddingLeft: 32, width: "100%" }}
              aria-label="Buscar"
            />
          </label>
          {consulta === "ordenes" && <TablaOrdenes copia={copia} texto={texto} />}
          {consulta === "existencias" && <TablaExistencias copia={copia} texto={texto} />}
          {consulta === "clientes" && <TablaClientes copia={copia} texto={texto} />}
        </>
      )}
    </div>
  );
}

function Vacio() {
  return <p style={{ color: "var(--ink-3)" }}>No hay nada que coincida.</p>;
}

function Tope({ n }: { n: number }) {
  return n >= MAXIMO_FILAS ? <p style={{ color: "var(--ink-3)", fontSize: 13 }}>Se muestran los primeros {MAXIMO_FILAS}. Busca para afinar.</p> : null;
}

function TablaOrdenes({ copia, texto }: { copia: CopiaLocal; texto: string }) {
  const filas = useMemo(() => ordenesLocal(copia, texto), [copia, texto]);
  if (filas.length === 0) return <Vacio />;
  return (
    <>
      <TarjetaTabla>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Estado</th>
              <th>Cliente</th>
              <th>Equipo</th>
              <th>Recibida</th>
              <th style={{ textAlign: "right" }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((o) => (
              <tr key={o.id}>
                <td className="cifra" style={{ fontWeight: 700 }}>{o.numero}</td>
                <td>{o.estado in ETIQUETA_ESTADO ? <EstadoOrden estado={o.estado as Estado} /> : o.estado}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{o.cuenta?.clienteNombre ?? "—"}</div>
                  <div className="cifra" style={{ color: "var(--ink-3)", fontSize: 13 }}>{o.cuenta?.clienteTelefono ?? ""}</div>
                </td>
                <td style={{ color: "var(--ink-2)" }}>
                  {[o.tipo, o.marca, o.modelo].filter(Boolean).join(" · ") || "—"}
                  {o.cuenta?.motivo ? <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{o.cuenta.motivo}</div> : null}
                </td>
                <td style={{ color: "var(--ink-2)" }}>{hora(o.abiertaEn)}</td>
                <td className="cifra" style={{ textAlign: "right" }}>{o.cuenta ? fmt(o.cuenta.saldo) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TarjetaTabla>
      <Tope n={filas.length} />
    </>
  );
}

function TablaExistencias({ copia, texto }: { copia: CopiaLocal; texto: string }) {
  const filas = useMemo(() => existenciasLocal(copia, texto), [copia, texto]);
  if (filas.length === 0) return <Vacio />;
  return (
    <>
      <TarjetaTabla>
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th style={{ textAlign: "right" }}>Precio</th>
              <th style={{ textAlign: "right" }}>Disponible aquí</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={`${f.clase}-${f.id}`}>
                <td className="cifra" style={{ color: "var(--ink-2)" }}>{f.codigo}</td>
                <td style={{ fontWeight: 600 }}>
                  {f.nombre}
                  {f.clase === "articulo" && f.serie ? <div style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 400 }}>Serie {f.serie}</div> : null}
                </td>
                <td className="cifra" style={{ textAlign: "right" }}>{fmt(f.precio)}</td>
                <td className="cifra" style={{ textAlign: "right" }}>
                  {f.clase === "repuesto" ? (
                    <>
                      {f.disponible}
                      {f.reservado > 0 ? <span style={{ color: "var(--ink-3)", fontSize: 13 }}> ({f.reservado} reservado)</span> : null}
                    </>
                  ) : (
                    "1"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TarjetaTabla>
      <Tope n={filas.length} />
    </>
  );
}

function TablaClientes({ copia, texto }: { copia: CopiaLocal; texto: string }) {
  const filas = useMemo(() => clientesLocal(copia, texto), [copia, texto]);
  if (filas.length === 0) return <Vacio />;
  return (
    <>
      <TarjetaTabla>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Documento</th>
              <th>Teléfono</th>
              <th>Correo</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                <td className="cifra" style={{ color: "var(--ink-2)" }}>{c.documento ?? "—"}</td>
                <td className="cifra" style={{ color: "var(--ink-2)" }}>{c.telefono ?? "—"}</td>
                <td style={{ color: "var(--ink-2)" }}>{c.correo ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TarjetaTabla>
      <Tope n={filas.length} />
    </>
  );
}
