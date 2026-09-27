"use client";

/**
 * El menú lateral de las tres puertas -- la estructura estándar de la
 * plataforma, igual para cualquier empresa; lo que cambia por empresa
 * es su logo, su color y el bloque de marca del pie
 * (lib/configuracion.ts, componentes/ui/bloque-marca.tsx).
 *
 * Ese color ya no llega por prop: el layout raíz lo pone como --accent
 * en <html> y aquí se lee de la variable, igual que en el resto del
 * sistema. Una fuente menos que mantener sincronizada.
 *
 * Cliente porque necesita usePathname() para resaltar la página activa
 * y para el estado del cajón en móvil.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export interface ItemNavLateral {
  href: string;
  etiqueta: string;
  // Un ícono YA RENDERIZADO (<ClipboardList size={18} .../>), no el
  // componente en sí -- los layouts que arman esta lista corren en el
  // servidor y este componente es de cliente; pasar el componente de
  // lucide-react tal cual (una función) entre esos dos mundos revienta
  // en producción con "Functions cannot be passed directly to Client
  // Components" (no en local: solo se ve al servir una ruta dinámica
  // de verdad, `next build` no llega a renderizarlas). Un elemento ya
  // renderizado sí es serializable a través de esa frontera.
  icono: React.ReactNode;
}

export function BarraLateral({
  items,
  logoUrl,
  nombreEmpresa,
  etiquetaPuerta,
  pie,
}: {
  items: ItemNavLateral[];
  logoUrl: string | null;
  nombreEmpresa: string;
  etiquetaPuerta: string;
  pie?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  // Cambiar de página cierra el cajón -- si no, queda tapando la
  // pantalla nueva y hay que ir a cerrarlo a mano.
  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  return (
    <>
      {/* Bajo ~640px el menú deja de ser un riel de solo íconos fijo (se
          comía un tercio de la pantalla en un catálogo con 30+
          categorías, sin dejar campo para nada más) y pasa a un cajón
          que se abre con este botón -- oculto por completo el resto
          del tiempo, así el catálogo tiene toda la pantalla. */}
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={abierto}
        className="bl-hamburguesa"
      >
        {abierto ? <X size={20} strokeWidth={2.2} /> : <Menu size={20} strokeWidth={2.2} />}
      </button>

      {abierto && <div className="bl-fondo" onClick={() => setAbierto(false)} aria-hidden />}

      <aside className={`barra-lateral${abierto ? " barra-lateral-abierta" : ""}`}>
        <style>{`
          .barra-lateral{width:220px;min-height:100vh;background:var(--chrome);background-image:linear-gradient(170deg,var(--chrome-2) 0%,var(--chrome) 46%,#000 100%);color:var(--chrome-texto);display:flex;flex-direction:column;flex-shrink:0;}
          .barra-lateral .bl-texto{display:block;}
          .barra-lateral .bl-link{display:flex;align-items:center;gap:11px;height:44px;padding:0 13px;border-radius:var(--r-md);color:var(--chrome-tenue);font-size:14px;font-weight:600;text-decoration:none;transition:background .14s ease,color .14s ease;}
          .barra-lateral .bl-link:hover{background:rgba(255,255,255,.07);color:#fff;text-decoration:none;}
          .barra-lateral .bl-link[aria-current="page"]{background:var(--accent);color:var(--accent-texto);box-shadow:0 10px 20px -12px rgba(0,0,0,.9);}
          .barra-lateral .bl-link:focus-visible{outline:none;box-shadow:0 0 0 2px var(--chrome),0 0 0 5px var(--accent-aro);}
          .bl-hamburguesa{display:none;}
          .bl-fondo{display:none;}
          @media (max-width:640px){
            .bl-hamburguesa{
              display:flex;align-items:center;justify-content:center;
              position:fixed;top:12px;left:12px;z-index:60;
              width:42px;height:42px;border:none;border-radius:var(--r-md);
              background:var(--chrome);color:#fff;box-shadow:0 6px 16px -6px rgba(0,0,0,.6);
            }
            .bl-fondo{display:block;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:45;}
            .barra-lateral{
              position:fixed;top:0;left:0;height:100vh;width:220px;z-index:50;
              transform:translateX(-100%);transition:transform .18s ease;
            }
            .barra-lateral-abierta{transform:translateX(0);}
          }
        `}</style>

        <div
          className="bl-cabecera"
          style={{
            padding: "18px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: "1px solid var(--chrome-linea)",
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={nombreEmpresa}
              style={{ height: 34, width: 34, objectFit: "contain", borderRadius: "var(--r-sm)", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                height: 34,
                width: 34,
                borderRadius: "var(--r-sm)",
                background: "var(--accent)",
                color: "var(--accent-texto)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {nombreEmpresa.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div className="bl-texto" style={{ minWidth: 0 }}>
            <strong style={{ fontSize: 14, lineHeight: 1.25, display: "block" }}>
              {nombreEmpresa || "Taller SaaS"}
            </strong>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--chrome-apagado)" }}>
              {etiquetaPuerta}
            </div>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", padding: 8, gap: 2, flex: 1, overflowY: "auto" }}>
          {items.map(({ href, etiqueta, icono }) => {
            const activo = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="bl-link"
                title={etiqueta}
                aria-current={activo ? "page" : undefined}
              >
                <span style={{ display: "flex", flexShrink: 0 }}>{icono}</span>
                <span className="bl-texto">{etiqueta}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sin foto de marca configurada, el nombre de la empresa hace de
            rótulo en la voz de marca -- con foto (BloqueMarca), esta va a
            sangre, sin el padding que sí necesita el rótulo de texto. */}
        <div
          className="bl-pie"
          style={pie ? { borderTop: "1px solid var(--chrome-linea)" } : { padding: "16px 16px 18px", borderTop: "1px solid var(--chrome-linea)" }}
        >
          {pie ?? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ width: 30, height: 3, borderRadius: 2, background: "var(--accent)" }} />
              <div className="marca" style={{ fontSize: 20, lineHeight: 1.05, color: "#fff" }}>
                {nombreEmpresa || "Taller SaaS"}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
