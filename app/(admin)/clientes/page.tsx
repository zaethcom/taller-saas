/**
 * Directorio de clientes de la empresa. Un cliente puede tener varios
 * equipos (tabla `producto`, ver /equipos) y varias órdenes a lo largo
 * del tiempo -- esta pantalla es solo el directorio; el historial vive
 * en cada orden.
 */
import { Contact } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { TarjetaTabla } from "@/componentes/ui/tarjeta";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

export default async function PaginaClientes() {
  const supabase = await clienteServidor();

  const { data: clientes } = await supabase
    .from("cliente")
    .select("id, nombre, documento, telefono, correo")
    .order("nombre");

  return (
    <div>
      <TituloPantalla
        icono={<Contact size={24} strokeWidth={2} />}
        titulo="Clientes"
        descripcion="El historial de equipos y órdenes de cada cliente vive en cada orden, no aquí."
      />

      {(clientes ?? []).length === 0 ? (
        <p style={{ color: "var(--ink-3)" }}>Todavía no hay clientes.</p>
      ) : (
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
              {(clientes ?? []).map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  <td style={{ color: "var(--ink-2)" }} className="cifra">
                    {c.documento ?? "—"}
                  </td>
                  <td style={{ color: "var(--ink-2)" }} className="cifra">
                    {c.telefono ?? "—"}
                  </td>
                  <td style={{ color: "var(--ink-2)" }}>{c.correo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TarjetaTabla>
      )}
    </div>
  );
}
