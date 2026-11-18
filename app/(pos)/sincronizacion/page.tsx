/**
 * Lo guardado sin conexión en este equipo (plan sin internet, fase 3):
 * lo que falta subir y lo que quedó para revisar.
 */
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { ListaSincronizacion } from "./lista";

export default function Page() {
  return (
    <div style={{ maxWidth: 760 }}>
      <TituloPantalla
        titulo="Guardado sin conexión"
        descripcion="Ventas hechas en este equipo sin internet. Se suben solas cuando vuelve la conexión."
      />
      <ListaSincronizacion />
    </div>
  );
}
