/**
 * Después de iniciar sesión: ¿en qué sede estás entrando? Solo muestra
 * las sedes a las que el usuario tiene acceso (0042_perfil_sede.sql).
 * También se llega aquí desde la barra superior para cambiar de sede, y
 * los layouts de las tres puertas mandan aquí a quien tiene varias
 * sedes permitidas y todavía no eligió en este dispositivo.
 */
import { redirect } from "next/navigation";
import { obtenerPerfilActual, ATERRIZAJE_POR_ROL } from "@/lib/perfil";
import { clienteServidor } from "@/lib/supabase/servidor";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { SelectorSede } from "@/componentes/ui/selector-sede";

export default async function PaginaElegirSede({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) redirect("/login");

  // Solo rutas internas: un ?volver= hacia otro dominio no debe usarse
  // para mandar al usuario fuera de la aplicación.
  const { volver } = await searchParams;
  const destino = volver?.startsWith("/") && !volver.startsWith("//") ? volver : ATERRIZAJE_POR_ROL[perfil.rol];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "var(--chrome)",
        backgroundImage: "linear-gradient(160deg, var(--chrome-2) 0%, var(--chrome) 48%, #000 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 28,
          borderRadius: "var(--r-lg)",
          background: "#fff",
          boxShadow: "0 30px 60px -30px rgba(0,0,0,0.9)",
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <div className="marca" style={{ fontSize: 22, color: "#131417", lineHeight: 1.1 }}>
            ¿En qué sede estás?
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7078" }}>
            {perfil.nombre} · {perfil.empresaNombre}. Las ventas, el turno de caja y las órdenes quedan en la sede que
            elijas.
          </p>
        </div>

        {perfil.sedesPermitidas.length === 0 ? (
          <p style={{ fontSize: 14, color: "#131417" }}>
            Tu usuario no tiene ninguna sede asignada. Pídele a un administrador que te dé acceso a una en /usuarios.
          </p>
        ) : (
          <SelectorSede sedes={perfil.sedesPermitidas} actual={perfil.sedeId} destino={destino} />
        )}

        <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
          <CerrarSesion oscuro={false} />
        </div>
      </div>
    </main>
  );
}
