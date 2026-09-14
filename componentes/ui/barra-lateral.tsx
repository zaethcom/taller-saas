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
 * Cliente porque necesita usePathname() para resaltar la página activa.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <aside className="barra-lateral">
      {/* Bajo ~640px (celular en la puerta del taller, usado con una sola
          mano) el texto se oculta y queda un riel de solo íconos -- un
          menú de 220px fijo se comería más de la mitad de esa pantalla. */}
      <style>{`
        .barra-lateral{width:220px;min-height:100vh;background:var(--chrome);background-image:linear-gradient(170deg,var(--chrome-2) 0%,var(--chrome) 46%,#000 100%);color:var(--chrome-texto);display:flex;flex-direction:column;flex-shrink:0;}
        .barra-lateral .bl-texto{display:block;}
        .barra-lateral .bl-link{display:flex;align-items:center;gap:11px;height:44px;padding:0 13px;border-radius:var(--r-md);color:var(--chrome-tenue);font-size:14px;font-weight:600;text-decoration:none;transition:background .14s ease,color .14s ease;}
        .barra-lateral .bl-link:hover{background:rgba(255,255,255,.07);color:#fff;text-decoration:none;}
        .barra-lateral .bl-link[aria-current="page"]{background:var(--accent);color:var(--accent-texto);box-shadow:0 10px 20px -12px rgba(0,0,0,.9);}
        .barra-lateral .bl-link:focus-visible{outline:none;box-shadow:0 0 0 2px var(--chrome),0 0 0 5px var(--accent-aro);}
        @media (max-width:640px){
          .barra-lateral{width:64px;}
          .barra-lateral .bl-texto{display:none;}
          .barra-lateral .bl-cabecera{justify-content:center;padding:14px 8px;}
          .barra-lateral .bl-link{justify-content:center;padding:12px 4px;}
          .barra-lateral .bl-pie{display:none;}
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
  );
}
