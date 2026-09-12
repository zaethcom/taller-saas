"use client";

/**
 * El menú lateral que reemplaza la barra superior en las tres puertas
 * -- la estructura estándar de la plataforma (referencia: Team Polaco
 * Scooter), igual para cualquier empresa; lo que cambia por empresa es
 * su logo y su color (lib/configuracion.ts).
 *
 * Cliente porque necesita usePathname() para resaltar la página activa
 * -- algo que la barra superior anterior nunca hacía.
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
  colorPrincipal,
  etiquetaPuerta,
  pie,
}: {
  items: ItemNavLateral[];
  logoUrl: string | null;
  nombreEmpresa: string;
  colorPrincipal: string;
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
        .barra-lateral{width:220px;min-height:100vh;background:#0b1418;color:#fff;display:flex;flex-direction:column;flex-shrink:0;}
        .barra-lateral .bl-texto{display:block;}
        @media (max-width:640px){
          .barra-lateral{width:64px;}
          .barra-lateral .bl-texto{display:none;}
          .barra-lateral .bl-cabecera{justify-content:center;padding:14px 8px;}
          .barra-lateral .bl-link{justify-content:center;padding:12px 4px;}
        }
      `}</style>
      <div
        className="bl-cabecera"
        style={{
          padding: "18px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid #223038",
        }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={nombreEmpresa}
            style={{ height: 32, width: 32, objectFit: "contain", borderRadius: 6, flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              height: 32,
              width: 32,
              borderRadius: 6,
              background: colorPrincipal,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {nombreEmpresa.charAt(0).toUpperCase() || "?"}
          </div>
        )}
        <div className="bl-texto">
          <strong style={{ fontSize: 14, lineHeight: 1.25 }}>{nombreEmpresa || "Taller SaaS"}</strong>
          <div style={{ fontSize: 11, color: "#7c8a92" }}>{etiquetaPuerta}</div>
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 8,
                textDecoration: "none",
                color: activo ? "#fff" : "#b7c3ca",
                background: activo ? colorPrincipal : "transparent",
                fontSize: 14,
                fontWeight: activo ? 600 : 400,
              }}
            >
              <span style={{ display: "flex", flexShrink: 0 }}>{icono}</span>
              <span className="bl-texto">{etiqueta}</span>
            </Link>
          );
        })}
      </nav>

      {pie && (
        <div className="bl-texto" style={{ padding: 12, borderTop: "1px solid #223038" }}>
          {pie}
        </div>
      )}
    </aside>
  );
}
