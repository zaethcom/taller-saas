/**
 * El enlace a la última versión de la app Android del puente de
 * impresión. El workflow .github/workflows/puente-apk.yml reemplaza
 * puente.apk en el release «puente-dev» en cada compilación, así que este
 * enlace siempre da la última. El repositorio es público: se descarga
 * desde el celular sin cuenta de GitHub. Como el APK va firmado siempre
 * con la misma llave, se instala encima de la anterior sin perder la
 * vinculación ni las impresoras.
 */
import { Download, Smartphone } from "lucide-react";
import { BotonEnlace } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";

export const URL_APK_PUENTE = "https://github.com/zaethcom/taller-saas/releases/download/puente-dev/puente.apk";

export function DescargaPuente() {
  return (
    <Tarjeta>
      <h2 style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Smartphone size={18} strokeWidth={2} />
        App del puente de impresión (Android)
      </h2>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--ink-2)" }}>
        Para un celular, tablet o equipo con Android que tenga las impresoras conectadas por USB. Abre este
        enlace en ese equipo, instala el archivo y vincúlalo con el código de Sedes. Si ya tiene la app, se
        actualiza encima sin perder la configuración.
      </p>
      <BotonEnlace
        href={URL_APK_PUENTE}
        variante="primario"
        tamano="sm"
        icono={<Download size={15} strokeWidth={2} />}
      >
        Descargar la última versión (APK)
      </BotonEnlace>
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-3)" }}>
        Android puede pedir permiso para «instalar apps de origen desconocido» la primera vez. En un Chromebook o
        PC con Chrome no hace falta la app: usa las impresoras USB de abajo y /estacion.
      </p>
    </Tarjeta>
  );
}
