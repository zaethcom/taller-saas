/**
 * Un Informe (lib/reportes/tipos.ts) a Excel o a PDF. Solo servidor: lo
 * usa app/api/reportes/exportar/route.ts.
 *
 * En Excel los números van crudos con formato de celda -- no como texto
 * ya formateado -- para que el cliente pueda sumar, filtrar y hacer sus
 * propias tablas dinámicas. En PDF van formateados igual que en
 * pantalla (lib/reportes/formato.ts).
 */
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatear } from "./formato";
import type { Columna, Formato, Informe, Valor } from "./tipos";

export interface Encabezado {
  empresa: string;
  /** "01/10/2026 al 07/10/2026", o null si el informe no usa fechas. */
  rango: string | null;
  sede: string | null;
  generado: string;
}

function subtitulos(e: Encabezado): string[] {
  return [
    e.empresa,
    e.rango ? `Periodo: ${e.rango}` : null,
    e.sede ? `Sede: ${e.sede}` : null,
    `Generado: ${e.generado}`,
  ].filter((s): s is string => !!s);
}

// ── Excel ───────────────────────────────────────────────────────────

const FORMATO_EXCEL: Partial<Record<Formato, string>> = {
  moneda: '"$"#,##0',
  numero: "#,##0",
  porcentaje: '0.0"%"',
  fecha: "dd/mm/yyyy",
  fechaHora: "dd/mm/yyyy hh:mm",
};

/** La celda de Excel para un valor: número o fecha de verdad cuando se puede. */
function celda(valor: Valor, formato: Formato): string | number | Date | null {
  if (valor === null || valor === "") return null;
  if (formato === "horas") return formatear(valor, formato);
  if ((formato === "fecha" || formato === "fechaHora") && typeof valor === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return new Date(`${valor}T00:00:00Z`);
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return valor;
    // Excel no tiene zona horaria: se guarda la hora de Colombia como si fuera UTC.
    return new Date(d.getTime() - 5 * 60 * 60 * 1000);
  }
  return valor;
}

export async function informeAExcel(informe: Informe, e: Encabezado): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = e.empresa;
  libro.created = new Date();
  const hoja = libro.addWorksheet(informe.titulo.slice(0, 31));

  const anchoCols = Math.max(2, ...informe.tablas.map((t) => t.columnas.length));
  const titulo = hoja.addRow([informe.titulo]);
  titulo.font = { bold: true, size: 14 };
  for (const s of subtitulos(e)) hoja.addRow([s]).font = { color: { argb: "FF555555" } };
  hoja.addRow([]);

  if (informe.resumen.length) {
    for (const c of informe.resumen) {
      const fila = hoja.addRow([c.rotulo, celda(c.valor, c.formato)]);
      fila.getCell(1).font = { bold: true };
      const nf = FORMATO_EXCEL[c.formato];
      if (nf) fila.getCell(2).numFmt = nf;
    }
    hoja.addRow([]);
  }

  const anchos = new Array<number>(anchoCols).fill(10);
  const medir = (i: number, texto: string) => {
    anchos[i] = Math.min(60, Math.max(anchos[i] ?? 10, texto.length + 2));
  };

  for (const tabla of informe.tablas) {
    if (tabla.titulo) hoja.addRow([tabla.titulo]).font = { bold: true, size: 12 };
    const cab = hoja.addRow(tabla.columnas.map((c) => c.titulo));
    cab.eachCell((c, i) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B6C78" } };
      c.alignment = { vertical: "middle", wrapText: true };
      medir(i - 1, String(c.value ?? ""));
    });
    const primera = cab.number;

    const escribir = (valores: Record<string, Valor>, negrita: boolean) => {
      const fila = hoja.addRow(tabla.columnas.map((c) => celda(valores[c.clave] ?? null, c.formato)));
      tabla.columnas.forEach((c: Columna, i) => {
        const cel = fila.getCell(i + 1);
        const nf = FORMATO_EXCEL[c.formato];
        if (nf && typeof cel.value !== "string") cel.numFmt = nf;
        if (negrita) cel.font = { bold: true };
        medir(i, formatear(valores[c.clave] ?? null, c.formato));
      });
      return fila;
    };

    for (const f of tabla.filas) escribir(f, false);
    if (tabla.filas.length === 0) hoja.addRow(["Sin datos en este periodo."]).font = { italic: true };
    if (tabla.totales) {
      const tot = escribir(tabla.totales, true);
      tot.eachCell((c) => {
        c.border = { top: { style: "thin" } };
      });
    }
    if (tabla.filas.length) {
      hoja.autoFilter = { from: { row: primera, column: 1 }, to: { row: primera + tabla.filas.length, column: tabla.columnas.length } };
    }
    hoja.addRow([]);
  }

  for (const n of informe.notas) hoja.addRow([n]).font = { italic: true, color: { argb: "FF555555" } };

  anchos.forEach((w, i) => {
    hoja.getColumn(i + 1).width = Math.max(w, i === 0 ? 24 : 10);
  });

  return Buffer.from(await libro.xlsx.writeBuffer());
}

// ── PDF ─────────────────────────────────────────────────────────────

const ALINEAR_DERECHA: Formato[] = ["moneda", "numero", "porcentaje", "horas"];

export function informeAPdf(informe: Informe, e: Encabezado): ArrayBuffer {
  const anchas = Math.max(...informe.tablas.map((t) => t.columnas.length), 0) > 5;
  const doc = new jsPDF({ orientation: anchas ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const margen = 36;
  const ancho = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(informe.titulo, margen, margen + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  let y = margen + 24;
  for (const s of subtitulos(e)) {
    doc.text(s, margen, y);
    y += 12;
  }
  doc.setTextColor(20);
  y += 6;

  if (informe.resumen.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: margen, right: margen },
      theme: "plain",
      head: [informe.resumen.map((c) => c.rotulo)],
      body: [informe.resumen.map((c) => formatear(c.valor, c.formato))],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { textColor: 110, fontStyle: "normal", fontSize: 8 },
      bodyStyles: { fontStyle: "bold", fontSize: 12 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  }

  for (const tabla of informe.tablas) {
    if (tabla.titulo) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(tabla.titulo, margen, y);
      doc.setFont("helvetica", "normal");
      y += 6;
    }
    const derecha = Object.fromEntries(
      tabla.columnas.map((c, i) => [i, { halign: ALINEAR_DERECHA.includes(c.formato) ? ("right" as const) : ("left" as const) }]),
    );
    autoTable(doc, {
      startY: y,
      margin: { left: margen, right: margen },
      head: [tabla.columnas.map((c) => c.titulo)],
      body: tabla.filas.length
        ? tabla.filas.map((f) => tabla.columnas.map((c) => formatear(f[c.clave] ?? null, c.formato)))
        : [[{ content: "Sin datos en este periodo.", colSpan: tabla.columnas.length, styles: { fontStyle: "italic", textColor: 120 } }]],
      foot: tabla.totales && tabla.filas.length ? [tabla.columnas.map((c) => (tabla.totales![c.clave] == null ? "" : formatear(tabla.totales![c.clave] ?? null, c.formato)))] : undefined,
      showFoot: "lastPage",
      styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [11, 108, 120], textColor: 255 },
      footStyles: { fillColor: [238, 241, 243], textColor: 20, fontStyle: "bold" },
      columnStyles: derecha,
      didParseCell: (d) => {
        if ((d.section === "head" || d.section === "foot") && ALINEAR_DERECHA.includes(tabla.columnas[d.column.index]?.formato ?? "texto")) {
          d.cell.styles.halign = "right";
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  if (informe.notas.length) {
    doc.setFontSize(8);
    doc.setTextColor(100);
    for (const n of informe.notas) {
      const lineas = doc.splitTextToSize(n, ancho - margen * 2) as string[];
      if (y + lineas.length * 10 > doc.internal.pageSize.getHeight() - margen) {
        doc.addPage();
        y = margen;
      }
      doc.text(lineas, margen, y);
      y += lineas.length * 10 + 4;
    }
  }

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Página ${p} de ${paginas}`, ancho - margen, doc.internal.pageSize.getHeight() - 18, { align: "right" });
  }

  return doc.output("arraybuffer");
}
