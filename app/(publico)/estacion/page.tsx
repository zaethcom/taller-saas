/**
 * /estacion -- imprimir desde Chrome por USB, sin app ni computador con
 * Node. No pide cuenta: el código de vinculación que genera un
 * administrador en /sedes es la autorización, igual que en la app
 * Android del puente.
 */
import { EstacionNavegador } from "@/componentes/estacion/estacion-navegador";

export const metadata = { title: "Estación de impresión" };

export default function PaginaEstacion() {
  return (
    <main style={{ padding: "28px 20px 48px", maxWidth: 560, margin: "0 auto" }}>
      <div className="pila">
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Estación de impresión</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
            Este equipo imprime los tickets y etiquetas de la sede por USB, directo desde Chrome.
          </p>
        </div>
        <EstacionNavegador />
      </div>
    </main>
  );
}
