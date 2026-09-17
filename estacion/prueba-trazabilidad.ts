/**
 * Prueba real de las plantillas de producción de etiqueta.ts contra la
 * Argox real -- versión final: QR real + código de entrada (sin logo,
 * sin los demás campos -- no entraban en la etiqueta de 30x25mm, ver
 * comentario de cabecera de etiqueta.ts) y la etiqueta de repuesto con
 * código de barras.
 */
import { DestinoPuenteAndroid } from "./destino";
import { etiquetaQrPplb, etiquetaRepuestoPplb } from "./etiqueta";

const etiquetas = new DestinoPuenteAndroid("192.168.20.89", 9101);

async function main() {
  const qr = etiquetaQrPplb({ codigoEntrada: "PS000123" });

  console.log("Enviando etiqueta QR de orden (diseño final: QR + código):\n" + qr + "\n");
  await etiquetas.enviar(qr);
  console.log("OK: confirmada por el puente.\n");

  const repuesto = etiquetaRepuestoPplb({
    nombreEmpresa: "Polaco Scooter",
    codigo: "F-1023",
    descripcion: "Pastilla de freno delantera",
    cantidadCopias: 1,
  });

  console.log("Enviando etiqueta de repuesto (con código de barras B):\n" + repuesto + "\n");
  await etiquetas.enviar(repuesto);
  console.log("OK: confirmada por el puente.");

  console.log(
    "\nRevisá en el papel: (1) el QR de la etiqueta de orden entra completo y decodifica bien, " +
      "y el código de texto debajo se lee; (2) el código de barras de la etiqueta de repuesto se ve " +
      "como barras reales y escanea.",
  );
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
