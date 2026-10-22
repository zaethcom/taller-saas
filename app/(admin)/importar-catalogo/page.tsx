"use client";

/**
 * Cargar el catálogo de la empresa desde un Excel (hojas Repuestos,
 * Accesorios y Servicios): primero se previsualiza qué va a crear o
 * actualizar, y solo con "Importar" se escribe. Ver
 * app/api/catalogo/importar/route.ts y lib/catalogo-importar.ts.
 */
import { useState } from "react";
import { FileSpreadsheet, Upload, CheckCircle2 } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { VentanaError } from "@/componentes/ui/ventana-error";

interface Resumen {
  categorias: number;
  categoriasNuevas: number;
  repuestosNuevos: number;
  repuestosActualizados: number;
  enVenta: number;
  serviciosNuevos: number;
  serviciosActualizados: number;
  omitidas: { hoja: string; fila: number; motivo: string }[];
  hojas: string[];
  importado: boolean;
}

const MAX_OMITIDAS = 50;

export default function PaginaImportarCatalogo() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<"previsualizar" | "importar" | null>(null);

  async function enviar(modo: "previsualizar" | "importar") {
    if (!archivo) return;
    setProcesando(modo);
    setError(null);
    try {
      const form = new FormData();
      form.append("archivo", archivo);
      form.append("modo", modo);
      const res = await fetch("/api/catalogo/importar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo leer el archivo");
      setResumen(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo");
    } finally {
      setProcesando(null);
    }
  }

  const fila = (etiqueta: string, valor: number) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: "1px solid var(--rule)" }}>
      <span style={{ fontSize: 14 }}>{etiqueta}</span>
      <strong style={{ fontSize: 14 }}>{valor.toLocaleString("es-CO")}</strong>
    </div>
  );

  return (
    <div>
      <TituloPantalla
        titulo="Importar catálogo"
      />

      <div className="pila">
        <Tarjeta>
          <Campo
            etiqueta="Archivo de catálogo (.xlsx)"
            ayuda="Se leen las hojas Repuestos, Accesorios y Servicios. Columnas: codigo, descripcion, categoria, subcategoria, marca, modelo, costo, precio_venta, en_venta, observacion; en Servicios: codigo, nombre, precio, costo_estimado, tiempo_estimado_minutos, descripcion."
          >
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null);
                setResumen(null);
                setError(null);
              }}
            />
          </Campo>
          <div className="fila" style={{ gap: 8, marginTop: 12 }}>
            <Boton
              variante="contorno"
              icono={<FileSpreadsheet size={17} strokeWidth={2} />}
              onClick={() => enviar("previsualizar")}
              disabled={!archivo || procesando !== null}
            >
              {procesando === "previsualizar" ? "Leyendo…" : "Previsualizar"}
            </Boton>
            <Boton
              variante="primario"
              icono={<Upload size={17} strokeWidth={2.2} />}
              onClick={() => enviar("importar")}
              disabled={!archivo || !resumen || resumen.importado || procesando !== null}
            >
              {procesando === "importar" ? "Importando…" : "Importar"}
            </Boton>
          </div>
        </Tarjeta>

        {resumen && (
          <Tarjeta>
            {resumen.importado ? (
              <Aviso tono="ok" icono={<CheckCircle2 size={17} strokeWidth={2} />}>
                Catálogo importado. Las existencias no cambian: las unidades entran por Recibir mercancía.
              </Aviso>
            ) : (
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--ink-3)" }}>
                Vista previa de {resumen.hojas.join(", ")}. Todavía no se ha guardado nada.
              </p>
            )}
            {fila("Categorías nuevas", resumen.categoriasNuevas)}
            {fila("Repuestos y accesorios nuevos", resumen.repuestosNuevos)}
            {fila("Repuestos y accesorios a actualizar", resumen.repuestosActualizados)}
            {fila("De ellos, visibles en el mostrador", resumen.enVenta)}
            {fila("Servicios nuevos", resumen.serviciosNuevos)}
            {fila("Servicios a actualizar", resumen.serviciosActualizados)}
            {fila("Filas omitidas", resumen.omitidas.length)}
            {resumen.omitidas.length > 0 && (
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--ink-2)" }}>
                {resumen.omitidas.slice(0, MAX_OMITIDAS).map((o, i) => (
                  <li key={i}>
                    {o.hoja}
                    {o.fila ? ` fila ${o.fila}` : ""}: {o.motivo}
                  </li>
                ))}
                {resumen.omitidas.length > MAX_OMITIDAS && <li>… y {resumen.omitidas.length - MAX_OMITIDAS} más</li>}
              </ul>
            )}
          </Tarjeta>
        )}

        <VentanaError mensaje={error} onCerrar={() => setError(null)} />
      </div>
    </div>
  );
}
