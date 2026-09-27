/**
 * Puerta del superadministrador -- carpeta REAL, no un grupo de rutas:
 * a propósito queda en /superadmin, no escondida como (pos)/(taller)/
 * (admin), porque esto no es una empresa más: es la plataforma. Nadie
 * entra aquí por tener un rol dentro de una empresa -- entra por tener
 * fila propia en la tabla `superadmin` (0020_superadmin.sql).
 *
 * No lleva el color de ninguna empresa: --accent aquí es el negro de
 * la plataforma, porque quien está aquí no está dentro de un taller.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, LogOut } from "lucide-react";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { obtenerSuperadminActual } from "@/lib/superadmin";
import { clienteServidor } from "@/lib/supabase/servidor";

export default async function LayoutSuperadmin({ children }: { children: React.ReactNode }) {
  const supabase = await clienteServidor();
  const superadmin = await obtenerSuperadminActual(supabase);

  if (!superadmin) redirect("/login");

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          minHeight: 72,
          padding: "14px 20px",
          background: "var(--chrome)",
          backgroundImage: "linear-gradient(115deg, var(--chrome) 0%, var(--chrome-2) 62%, var(--chrome) 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: "var(--r-sm)",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
            }}
          >
            <Building2 size={19} strokeWidth={2} aria-hidden />
          </span>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--chrome-texto)" }}>Superadmin</div>
            <div style={{ fontSize: 11, color: "var(--chrome-apagado)" }}>{superadmin.nombre}</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/superadmin/empresas" className="btn btn-oscuro btn-sm">
            Empresas
          </Link>
          <CerrarSesion icono={<LogOut size={15} strokeWidth={2} />} />
        </nav>
      </header>
      <main style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
