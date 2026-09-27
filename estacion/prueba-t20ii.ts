/**
 * Prueba real contra la T20II a través del puente Android (puerto
 * 9100). Usa el comprobante de recepción rediseñado, con el logo real
 * de Polaco Scooter ya bajado y convertido (mismo pipeline que
 * lib/logo-bitmap.ts, pero corrido aquí directo para no depender de
 * tener la app completa desplegada con este código).
 */
import { DestinoPuenteAndroid } from "./destino";
import { comprobanteRecepcion } from "./plantillas/comprobante";

const url = "https://vqiwklxncnigqdpyakjs.supabase.co/storage/v1/object/public/logos/7824fd74-a822-4edb-ab2f-4f006a47ac09/logo.png?v=1789348219595";

async function generarLogoReciboDirecto() {
  const sharp = (await import("sharp")).default;
  const res = await fetch(url);
  const original = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(original)
    .resize({ width: 384, height: 160, fit: "inside" })
    .flatten({ background: "#ffffff" })
    .greyscale()
    .threshold(160)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const anchoDots = info.width;
  const altoDots = info.height;
  const anchoBytes = Math.ceil(anchoDots / 8);
  const datos = Buffer.alloc(anchoBytes * altoDots);
  for (let y = 0; y < altoDots; y++) {
    for (let x = 0; x < anchoDots; x++) {
      const negro = data.readUInt8(y * anchoDots + x) < 128;
      if (negro) {
        const i = y * anchoBytes + (x >> 3);
        datos.writeUInt8(datos.readUInt8(i) | (0x80 >> (x & 7)), i);
      }
    }
  }
  return { anchoDots, altoDots, datosBase64: datos.toString("base64") };
}

async function main() {
  console.log("Bajando y convirtiendo el logo real...");
  const logoRaster = await generarLogoReciboDirecto();
  console.log(`Logo: ${logoRaster.anchoDots}x${logoRaster.altoDots}`);

  const buffer = comprobanteRecepcion({
    empresaNombre: "Polaco Scooter",
    empresaDireccion: "Calle 00 # 00-00",
    empresaTelefono: "300 000 0000",
    reciboPie: "Gracias por su preferencia",
    logoRaster,
    numeroOrden: 123,
    codigoEntrada: "PS000123",
    clienteNombre: "Juan Pérez",
    clienteTelefono: "300 123 4567",
    producto: "Xiaomi Pro 2",
    serial: "XM123456",
    motivo: "No enciende",
    fecha: new Date().toLocaleDateString("es-CO"),
    urlSeguimiento: "https://taller-saas-mvp.vercel.app/seguimiento/prueba-impresion",
  });

  console.log(`Enviando comprobante (${buffer.length} bytes) a la T20II...`);
  const t20ii = new DestinoPuenteAndroid("192.168.20.89", 9100);
  await t20ii.enviar(buffer);
  console.log("OK: el puente confirmó la impresión.");
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
