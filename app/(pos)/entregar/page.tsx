"use client";

/**
 * Entrega: buscar la orden, cobrar el saldo pendiente, capturar firma
 * y foto de salida, y cerrar -- Fase 8 del plano de construcción.
 *
 * La transición a "entregada" la valida el servidor
 * (/api/ordenes/[id]/transicion) contra saldo_en_cero, tiene_firma y
 * tiene_foto_salida reales -- esta pantalla no duplica esa lógica,
 * solo intenta la transición y muestra el error si algo falta.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FirmaCanvas, type FirmaCanvasHandle } from "@/componentes/evidencia/firma-canvas";
import { subirEvidencia } from "@/lib/subir-evidencia";

interface OrdenEncontrada {
  id: string;
  numero: number;
  estado: string;
  saldoPendiente: number;
  producto: { marca: string | null; modelo: string | null; tipo: string; serial: string };
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaEntregar() {
  const router = useRouter();
  const firmaRef = useRef<FirmaCanvasHandle>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const [numero, setNumero] = useState("");
  const [orden, setOrden] = useState<OrdenEncontrada | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [medioPago, setMedioPago] = useState<"efectivo" | "transferencia" | "tarjeta">("efectivo");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [perfil, setPerfil] = useState<{ empresaId: string } | null>(null);

  async function buscar() {
    setError(null);
    setOrden(null);
    try {
      const [resOrden, resPerfil] = await Promise.all([
        fetch(`/api/ordenes/buscar?numero=${encodeURIComponent(numero.trim())}`),
        fetch("/api/perfil"),
      ]);
      if (!resOrden.ok) throw new Error((await resOrden.json()).error);
      setOrden(await resOrden.json());
      if (resPerfil.ok) {
        const p = await resPerfil.json();
        setPerfil({ empresaId: p.empresaId });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo buscar la orden");
    }
  }

  async function entregar() {
    if (!orden || !perfil) return;
    if (firmaRef.current?.estaVacio()) {
      setError("Falta la firma de quien recibe.");
      return;
    }
    if (!foto) {
      setError("Falta la foto de salida.");
      return;
    }

    setProcesando(true);
    setError(null);
    try {
      // 1. Cobrar el saldo pendiente, si lo hay.
      if (orden.saldoPendiente > 0) {
        const resVenta = await fetch("/api/ventas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ordenId: orden.id,
            medioPago,
            items: [{ repuestoId: "", descripcion: `Saldo orden #${orden.numero}`, cantidad: 1, precioUnit: orden.saldoPendiente }],
          }),
        });
        if (!resVenta.ok) throw new Error((await resVenta.json()).error);
      }

      // 2. Subir firma y foto de salida.
      const blobFirma = await firmaRef.current!.obtenerBlob();
      if (!blobFirma) throw new Error("No se pudo capturar la firma");

      await subirEvidencia({
        empresaId: perfil.empresaId,
        ordenId: orden.id,
        archivo: blobFirma,
        extension: "png",
        tipo: "firma",
      });
      await subirEvidencia({
        empresaId: perfil.empresaId,
        ordenId: orden.id,
        archivo: foto,
        extension: foto.name.split(".").pop() ?? "jpg",
        tipo: "foto",
        fase: "salida",
        visibleCliente: true,
      });

      // 3. Cerrar la orden. El servidor exige saldo_en_cero + firma + foto.
      const resTransicion = await fetch(`/api/ordenes/${orden.id}/transicion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aEstado: "entregada" }),
      });
      if (!resTransicion.ok) throw new Error((await resTransicion.json()).error);

      setListo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la entrega");
    } finally {
      setProcesando(false);
    }
  }

  if (listo) {
    return (
      <div>
        <h1>Orden #{orden!.numero} entregada</h1>
        <p>El comprobante se está imprimiendo en la estación de esta sede.</p>
        <button onClick={() => router.push("/vender")}>Volver</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Entregar</h1>

      {!orden ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Número de orden"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={buscar} disabled={!numero.trim()}>
            Buscar
          </button>
        </div>
      ) : (
        <>
          <p>
            {orden.producto.marca} {orden.producto.modelo} ({orden.producto.tipo}) ·{" "}
            {orden.producto.serial}
          </p>

          {orden.saldoPendiente > 0 ? (
            <section style={{ marginBottom: 20 }}>
              <p style={{ fontWeight: 700 }}>Saldo pendiente: {fmt(orden.saldoPendiente)}</p>
              <div style={{ display: "flex", gap: 8 }}>
                {(["efectivo", "transferencia", "tarjeta"] as const).map((m) => (
                  <button key={m} onClick={() => setMedioPago(m)} style={{ fontWeight: medioPago === m ? 700 : 400 }}>
                    {m}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <p style={{ color: "#2e7d32" }}>Sin saldo pendiente.</p>
          )}

          <section style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16 }}>Foto de salida</h2>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
          </section>

          <section style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16 }}>Firma de quien recibe</h2>
            <FirmaCanvas ref={firmaRef} />
            <button onClick={() => firmaRef.current?.limpiar()} style={{ marginTop: 8 }}>
              Borrar firma
            </button>
          </section>

          <button onClick={entregar} disabled={procesando} style={{ padding: "10px 20px" }}>
            {procesando ? "Procesando…" : orden.saldoPendiente > 0 ? `Cobrar y entregar ${fmt(orden.saldoPendiente)}` : "Entregar"}
          </button>
        </>
      )}
      {error && <p style={{ color: "#c0392b" }}>{error}</p>}
    </div>
  );
}
