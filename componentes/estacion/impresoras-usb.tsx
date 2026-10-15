"use client";

/**
 * Las impresoras USB conectadas a ESTE equipo, detectadas desde Chrome
 * (WebUSB) -- sin escribir IP ni puerto. Lo usan /estacion, que imprime
 * por ellas, y Configuración, para dejarlas listas desde ahí.
 *
 * Qué impresora es cuál se guarda en este navegador (localStorage), no
 * en la base: es una propiedad del equipo y sus cables, no de la sede.
 * Al abrir la pantalla se buscan solas las que Chrome ya tiene
 * permitidas; «Detectar impresora USB» abre el diálogo de Chrome con solo
 * impresoras, y la que se elija va sola a tickets o a etiquetas según la
 * marca (Zebra, Argox... son etiquetadoras).
 */
import { useCallback, useEffect, useState } from "react";
import { Printer, Tag, Usb as IconoUsb, Search, ArrowLeftRight, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Aviso } from "@/componentes/ui/campo";
import {
  FILTROS_IMPRESORA,
  coincide,
  huella,
  puestoPara,
  usbDelNavegador,
  type DispositivoUsb,
  type HuellaUsb,
  type RolImpresora,
} from "@/lib/impresion-usb";

export const NOMBRE_ROL: Record<RolImpresora, string> = { tickets: "Tickets", etiquetas: "Etiquetas" };
const ROLES: RolImpresora[] = ["tickets", "etiquetas"];
const CLAVE_IMPRESORAS = "estacion-navegador:impresoras";

type Huellas = Partial<Record<RolImpresora, HuellaUsb>>;
type Conectadas = Partial<Record<RolImpresora, DispositivoUsb>>;

function leerHuellas(): Huellas {
  try {
    const crudo = localStorage.getItem(CLAVE_IMPRESORAS);
    return crudo ? (JSON.parse(crudo) as Huellas) : {};
  } catch {
    return {};
  }
}

function guardarHuellas(h: Huellas) {
  try {
    localStorage.setItem(CLAVE_IMPRESORAS, JSON.stringify(h));
  } catch {
    // Sin almacenamiento (ventana privada): sirve hasta cerrar la pestaña.
  }
}

export function useImpresorasUsb() {
  const [soportado, setSoportado] = useState<boolean | null>(null);
  const [huellas, setHuellas] = useState<Huellas>({});
  const [conectadas, setConectadas] = useState<Conectadas>({});
  const [error, setError] = useState<string | null>(null);

  /**
   * Cruza lo guardado con lo que Chrome ya permite en este sitio; si un
   * puesto está vacío y hay una impresora permitida sin puesto, se la
   * asigna sola. Así, con la impresora ya autorizada, basta conectarla.
   */
  const refrescar = useCallback(async () => {
    const usb = usbDelNavegador();
    if (!usb) return;
    const dispositivos = await usb.getDevices();
    const h = { ...leerHuellas() };
    const sinPuesto = dispositivos.filter((d) => !ROLES.some((r) => h[r] && coincide(d, h[r]!)));
    let cambio = false;
    for (const d of sinPuesto) {
      const libres = ROLES.filter((r) => !h[r]);
      if (libres.length === 0) break;
      const rol = puestoPara(d, h);
      if (h[rol]) continue;
      h[rol] = huella(d);
      cambio = true;
    }
    if (cambio) guardarHuellas(h);
    setHuellas(h);
    const c: Conectadas = {};
    for (const rol of ROLES) {
      const buscada = h[rol];
      const d = buscada && dispositivos.find((x) => coincide(x, buscada));
      if (d) c[rol] = d;
    }
    setConectadas(c);
  }, []);

  useEffect(() => {
    const usb = usbDelNavegador();
    setSoportado(Boolean(usb));
    if (!usb) return;
    refrescar();
    const alCambiar = () => {
      refrescar();
    };
    usb.addEventListener("connect", alCambiar);
    usb.addEventListener("disconnect", alCambiar);
    return () => {
      usb.removeEventListener("connect", alCambiar);
      usb.removeEventListener("disconnect", alCambiar);
    };
  }, [refrescar]);

  /** Abre el diálogo de Chrome; `todos` muestra cualquier USB, no solo impresoras. */
  const detectar = useCallback(
    async (todos = false, rolPedido?: RolImpresora) => {
      const usb = usbDelNavegador();
      if (!usb) return;
      setError(null);
      try {
        const d = await usb.requestDevice({ filters: todos ? [] : FILTROS_IMPRESORA });
        const h = { ...leerHuellas() };
        // Si ya estaba en un puesto, se quita de ahí antes de ponerla.
        for (const r of ROLES) if (h[r] && coincide(d, h[r]!)) delete h[r];
        const rol = rolPedido ?? puestoPara(d, h);
        h[rol] = huella(d);
        guardarHuellas(h);
        await refrescar();
      } catch (e) {
        // Cerrar el diálogo sin elegir también llega aquí (NotFoundError).
        if (e instanceof Error && e.name !== "NotFoundError") setError(e.message);
      }
    },
    [refrescar],
  );

  const intercambiar = useCallback(() => {
    const h = leerHuellas();
    guardarHuellas({ tickets: h.etiquetas, etiquetas: h.tickets });
    refrescar();
  }, [refrescar]);

  const quitar = useCallback(
    (rol: RolImpresora) => {
      const h = leerHuellas();
      delete h[rol];
      guardarHuellas(h);
      refrescar();
    },
    [refrescar],
  );

  return { soportado, huellas, conectadas, error, detectar, intercambiar, quitar };
}

export function TarjetaImpresorasUsb({
  usb,
  pie,
}: {
  usb: ReturnType<typeof useImpresorasUsb>;
  pie?: React.ReactNode;
}) {
  const { soportado, huellas, conectadas, error, detectar, intercambiar, quitar } = usb;

  return (
    <Tarjeta>
      <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <IconoUsb size={16} strokeWidth={2} />
        Impresoras USB de este equipo
      </div>
      {soportado === false ? (
        <Aviso tono="aviso">
          Este navegador no puede ver impresoras USB. Abre esta pantalla en <strong>Google Chrome</strong> (o
          Edge) en el equipo que tiene las impresoras conectadas.
        </Aviso>
      ) : (
        <div className="pila" style={{ gap: 12 }}>
          {ROLES.map((rol) => {
            const h = huellas[rol];
            return (
              <div key={rol} className="fila" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {rol === "tickets" ? <Printer size={16} strokeWidth={2} /> : <Tag size={16} strokeWidth={2} />}
                <span style={{ fontWeight: 600, minWidth: 80 }}>{NOMBRE_ROL[rol]}</span>
                {h ? (
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{h.nombre}</span>
                ) : (
                  <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Sin detectar</span>
                )}
                {h &&
                  (conectadas[rol] ? (
                    <Etiqueta tono="ok">Conectada</Etiqueta>
                  ) : (
                    <Etiqueta tono="aviso">Desconectada</Etiqueta>
                  ))}
                <Boton variante="contorno" tamano="sm" onClick={() => detectar(false, rol)}>
                  {h ? "Cambiar" : "Elegir"}
                </Boton>
                {h && (
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    icono={<X size={14} strokeWidth={2} />}
                    onClick={() => quitar(rol)}
                    aria-label={`Quitar la impresora de ${NOMBRE_ROL[rol].toLowerCase()}`}
                  />
                )}
              </div>
            );
          })}
          <div className="fila" style={{ gap: 8, flexWrap: "wrap" }}>
            <Boton
              variante="primario"
              tamano="sm"
              icono={<Search size={15} strokeWidth={2} />}
              onClick={() => detectar(false)}
              disabled={soportado === null}
            >
              Detectar impresora USB
            </Boton>
            {(huellas.tickets || huellas.etiquetas) && (
              <Boton
                variante="contorno"
                tamano="sm"
                icono={<ArrowLeftRight size={15} strokeWidth={2} />}
                onClick={intercambiar}
              >
                Intercambiar tickets y etiquetas
              </Boton>
            )}
            <Boton variante="fantasma" tamano="sm" onClick={() => detectar(true)} disabled={soportado === null}>
              ¿No aparece? Ver todos los USB
            </Boton>
          </div>
          {error && <Aviso tono="peligro">{error}</Aviso>}
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
            Conecta la impresora por USB y toca «Detectar». Chrome muestra las impresoras que encuentra; elige
            una y queda puesta como de tickets o de etiquetas según la marca. Repite con la otra. Chrome pide
            permiso una sola vez por impresora.
          </p>
          {pie}
        </div>
      )}
    </Tarjeta>
  );
}

/** Para Configuración: detectar aquí y luego imprimir desde /estacion en este mismo equipo. */
export function ImpresorasUsbEsteEquipo() {
  const usb = useImpresorasUsb();
  return (
    <TarjetaImpresorasUsb
      usb={usb}
      pie={
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
          Para que este equipo imprima lo de la sede por estas impresoras, abre{" "}
          <a href="/estacion" target="_blank" rel="noreferrer">
            /estacion
          </a>{" "}
          aquí mismo y vincúlalo con el código de Sedes. Las impresoras que detectes aquí ya aparecen allá.
        </p>
      }
    />
  );
}
