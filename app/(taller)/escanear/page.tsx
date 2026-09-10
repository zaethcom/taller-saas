"use client";

/**
 * Escanear el QR de un equipo abre su orden activa -- la primera de
 * las dos promesas del proyecto. Placeholder de cámara: conectar aquí
 * una librería de lectura de QR (p. ej. @zxing/browser) que llame a
 * buscarPorSerial() con el contenido leído.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PaginaEscanear() {
  const router = useRouter();
  const [serial, setSerial] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscarPorSerial(valor: string) {
    setBuscando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/por-serial?serial=${encodeURIComponent(valor)}`);
      if (!res.ok) throw new Error("No se encontró una orden activa para ese equipo");
      const { ordenId } = await res.json();
      router.push(`/orden/${ordenId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al buscar la orden");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div>
      <h1>Escanear equipo</h1>
      <div
        style={{
          aspectRatio: "1",
          background: "#1a262c",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <span style={{ opacity: 0.5 }}>Cámara aquí</span>
      </div>

      <p style={{ opacity: 0.7, fontSize: 14 }}>
        Mientras se conecta el lector de cámara, se puede escribir el serial a mano:
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (serial.trim()) buscarPorSerial(serial.trim());
        }}
      >
        <input
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="Ej. RL-000001"
          style={{ width: "100%", padding: 12, borderRadius: 8, marginBottom: 8 }}
        />
        <button type="submit" disabled={buscando} style={{ width: "100%", padding: 12, borderRadius: 8 }}>
          {buscando ? "Buscando…" : "Buscar orden"}
        </button>
      </form>
      {error && <p style={{ color: "#ff8080" }}>{error}</p>}
    </div>
  );
}
