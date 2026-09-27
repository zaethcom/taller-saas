"use client";

/**
 * Entrega: buscar la orden, cobrar el saldo pendiente, capturar firma
 * y foto de salida, y cerrar -- Fase 8 del plano de construcción.
 *
 * La transición a "entregada" la valida el servidor
 * (/api/ordenes/[id]/transicion) contra saldo_en_cero, tiene_firma y
 * tiene_foto_salida reales -- esta pantalla no duplica esa lógica,
 * solo intenta la transición y muestra el error si algo falta. Lo que
 * sí hace la pantalla es mostrar cuáles de esos tres requisitos ya
 * están cumplidos, para que quien entrega no descubra lo que falta al
 * final, cuando el cliente ya está esperando en el mostrador.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Search, Check, Camera, PenLine, Eraser, Lock, Printer } from "lucide-react";
import { FirmaCanvas, type FirmaCanvasHandle } from "@/componentes/evidencia/firma-canvas";
import { subirEvidencia } from "@/lib/subir-evidencia";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface OrdenEncontrada {
  id: string;
  numero: number;
  estado: string;
  saldoPendiente: number;
  producto: { marca: string | null; modelo: string | null; tipo: string; serial: string };
}

interface Metodo {
  id: string;
  nombre: string;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaEntregar() {
  const router = useRouter();
  const firmaRef = useRef<FirmaCanvasHandle>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const [numero, setNumero] = useState("");
  const [orden, setOrden] = useState<OrdenEncontrada | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [metodoPagoId, setMetodoPagoId] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [perfil, setPerfil] = useState<{ empresaId: string } | null>(null);

  useEffect(() => {
    fetch("/api/metodos-pago")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setMetodos(data);
        if (data[0]) setMetodoPagoId(data[0].id);
      })
      .catch(() => {});
  }, []);

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
            metodoPagoId,
            items: [{ descripcion: `Saldo orden #${orden.numero}`, cantidad: 1, precioUnit: orden.saldoPendiente }],
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
      <Tarjeta style={{ textAlign: "center", padding: 36 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 58,
            height: 58,
            borderRadius: "var(--r-lg)",
            background: "var(--ok-fondo)",
            color: "var(--ok)",
            marginBottom: 14,
          }}
        >
          <Check size={30} strokeWidth={2.4} />
        </span>
        <h1>
          Orden <span className="cifra">#{orden!.numero}</span> entregada
        </h1>
        <p style={{ margin: "8px 0 20px", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Printer size={17} strokeWidth={2} aria-hidden />
          El comprobante se está imprimiendo en la estación de esta sede.
        </p>
        <Boton variante="primario" onClick={() => router.push("/vender")}>
          Volver a caja
        </Boton>
      </Tarjeta>
    );
  }

  return (
    <div>
      <TituloPantalla
        icono={<PackageCheck size={24} strokeWidth={2} />}
        titulo="Entregar"
        descripcion="Cobra el saldo, toma la foto de salida y la firma de quien recibe."
      />

      {!orden ? (
        <Tarjeta>
          <form
            className="fila"
            style={{ gap: 8, flexWrap: "nowrap" }}
            onSubmit={(e) => {
              e.preventDefault();
              buscar();
            }}
          >
            <input
              placeholder="Número de orden"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              aria-label="Número de orden"
              className="cifra"
            />
            <Boton type="submit" variante="primario" icono={<Search size={17} strokeWidth={2} />} disabled={!numero.trim()}>
              Buscar
            </Boton>
          </form>
          {error && (
            <div style={{ marginTop: 14 }}>
              <Aviso tono="peligro">{error}</Aviso>
            </div>
          )}
        </Tarjeta>
      ) : (
        <div className="pila">
          <Tarjeta>
            <div className="fila" style={{ justifyContent: "space-between" }}>
              <div>
                <h2>
                  {orden.producto.marca} {orden.producto.modelo}
                </h2>
                <p className="cifra" style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
                  {orden.producto.tipo} · {orden.producto.serial} · orden #{orden.numero}
                </p>
              </div>
              {orden.saldoPendiente > 0 ? (
                <Etiqueta tono="aviso" punto>
                  <span className="cifra">Saldo {fmt(orden.saldoPendiente)}</span>
                </Etiqueta>
              ) : (
                <Etiqueta tono="ok" punto>
                  Sin saldo pendiente
                </Etiqueta>
              )}
            </div>

            {orden.saldoPendiente > 0 && metodos.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="campo-etiqueta">Forma de pago del saldo</div>
                <div className="fila" style={{ gap: 8 }}>
                  {metodos.map((m) => (
                    <Boton
                      key={m.id}
                      variante={metodoPagoId === m.id ? "primario" : "contorno"}
                      onClick={() => setMetodoPagoId(m.id)}
                      aria-pressed={metodoPagoId === m.id}
                    >
                      {m.nombre}
                    </Boton>
                  ))}
                </div>
              </div>
            )}
          </Tarjeta>

          <Tarjeta>
            <h2 style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <Camera size={19} strokeWidth={2} color="var(--ink-2)" aria-hidden />
              Foto de salida
              {foto && <Etiqueta tono="ok" punto>Lista</Etiqueta>}
            </h2>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
              aria-label="Foto de salida del equipo"
              style={{ height: "auto", padding: 10 }}
            />
            <p className="campo-ayuda">Queda visible para el cliente en su enlace de seguimiento.</p>
          </Tarjeta>

          <Tarjeta>
            <h2 style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <PenLine size={19} strokeWidth={2} color="var(--ink-2)" aria-hidden />
              Firma de quien recibe
            </h2>
            <FirmaCanvas ref={firmaRef} />
            <div style={{ marginTop: 10 }}>
              <Boton
                variante="fantasma"
                tamano="sm"
                icono={<Eraser size={15} strokeWidth={2} />}
                onClick={() => firmaRef.current?.limpiar()}
              >
                Borrar firma
              </Boton>
            </div>
          </Tarjeta>

          <Boton
            variante="primario"
            tamano="xl"
            ancho
            icono={<Lock size={19} strokeWidth={2} />}
            onClick={entregar}
            disabled={procesando || (orden.saldoPendiente > 0 && !metodoPagoId)}
          >
            <span className="cifra">
              {procesando
                ? "Procesando…"
                : orden.saldoPendiente > 0
                  ? `Cobrar y entregar ${fmt(orden.saldoPendiente)}`
                  : "Entregar"}
            </span>
          </Boton>

          {error && <Aviso tono="peligro">{error}</Aviso>}
        </div>
      )}
    </div>
  );
}
