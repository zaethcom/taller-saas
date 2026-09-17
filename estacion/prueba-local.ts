/**
 * Manda datos de prueba realistas a través de las plantillas reales
 * (etiqueta.ts, plantillas/recibo.ts) y el transporte real (DestinoRed)
 * hacia el oyente local (escucha-local.mjs) -- verifica el pipeline
 * completo de generación + red, sin tocar producción ni una impresora
 * de verdad.
 *
 * Uso: primero `node estacion/escucha-local.mjs 9100 estacion/salida-etiquetas.txt`
 * y `node estacion/escucha-local.mjs 9200 estacion/salida-tickets.txt` en dos
 * terminales aparte, luego: npx tsx estacion/prueba-local.ts
 */
import { DestinoRed } from "./destino";
import { etiquetaQrZpl, etiquetaArticuloZpl, etiquetaRepuestoZpl } from "./etiqueta";
import { reciboVenta } from "./plantillas/recibo";

const etiquetas = new DestinoRed("127.0.0.1", 19100);
const tickets = new DestinoRed("127.0.0.1", 19200);

async function main() {
  console.log("Enviando etiqueta QR de prueba...");
  await etiquetas.enviar(
    etiquetaQrZpl({
      nombreEmpresa: "Polaco Scooter",
      codigoEntrada: "PRUEBA01",
      serial: "TEST-0001",
      tipo: "patineta",
      marca: "Xiaomi",
      modelo: "Pro 2",
      numeroOrden: 45,
      contenidoQr: "https://taller-saas-mvp.vercel.app/seguimiento/prueba-impresion",
    }),
  );

  console.log("Enviando etiqueta de artículo de prueba...");
  await etiquetas.enviar(
    etiquetaArticuloZpl({
      codigo: "ART-000123",
      tipo: "patineta",
      marca: "Xiaomi",
      modelo: "Pro 2",
    }),
  );

  console.log("Enviando etiqueta de repuesto de prueba...");
  await etiquetas.enviar(
    etiquetaRepuestoZpl({
      nombreEmpresa: "Polaco Scooter",
      codigo: "TEST-001",
      descripcion: "Pastilla de freno delantera",
      cantidadCopias: 3,
    }),
  );

  console.log("Enviando recibo de venta de prueba...");
  await tickets.enviar(
    reciboVenta({
      empresaNombre: "Polaco Scooter",
      empresaDireccion: "Calle 00 # 00-00",
      empresaTelefono: "300 000 0000",
      reciboPie: "Gracias por su preferencia",
      numeroVenta: 999,
      items: [
        { descripcion: "Pastilla de freno delantera", cantidad: 1, precioUnit: 45000 },
        { descripcion: "Mano de obra reparación de frenos", cantidad: 1, precioUnit: 30000 },
      ],
      total: 75000,
      medioPago: "Efectivo",
      abreCajon: true,
      cajero: "C001 · Prueba local",
      montoRecibido: 80000,
      cambio: 5000,
    }),
  );

  console.log("\nListo. Revisa estacion/salida-etiquetas.txt y estacion/salida-tickets.txt");
}

main().catch((err) => {
  console.error("Error en la prueba:", err);
  process.exit(1);
});
