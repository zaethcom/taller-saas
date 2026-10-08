import { describe, expect, it } from "vitest";
import { diaLocal, horaLocal, limitesUtc, lunesDe, diaSemanaLocal } from "../lib/reportes/fechas";
import { formatear } from "../lib/reportes/formato";
import {
  cierresDeCaja,
  ventasPorCategoria,
  ventasPorFecha,
  ventasPorHora,
  ventasPorProducto,
  ventasPorVendedor,
  utilidadArticulos,
  type Catalogos,
  type VentaFila,
} from "../lib/reportes/informes";
import { leerParametros } from "../lib/reportes/parametros";
import { informeAExcel, informeAPdf } from "../lib/reportes/exportar";

const cat: Catalogos = {
  personas: new Map([
    ["u1", { nombre: "Ana", codigo: "V01", rol: "cajero" }],
    ["u2", { nombre: "Luis", codigo: null, rol: "admin" }],
  ]),
  sedes: new Map([["s1", "Local 1"]]),
  repuestos: new Map([["r1", { codigo: "R-1", descripcion: "Llanta 10\"", categoria_id: "c1", costo: null, precio_venta: 50000 }]]),
  articulos: new Map([
    [
      "a1",
      { numero: 7, tipo: "Patineta", marca: "Xiaomi", modelo: "M365", categoria_id: null, costo: 800000, precio_venta: 1200000, condicion: "nuevo", estado: "vendido", sede_id: "s1" },
    ],
  ]),
  categorias: new Map([["c1", "Llantas"]]),
};

function venta(id: string, creada_en: string, total: number, creada_por = "u1", tipo = "mostrador"): VentaFila {
  return { id, numero: Number(id.replace(/\D/g, "")) || 1, sede_id: "s1", tipo, total, creada_por, creada_en, turno_id: "t1" };
}

describe("fechas en hora de Colombia", () => {
  it("una venta de las 8 p. m. del lunes cuenta como lunes, no martes", () => {
    // 2026-10-06T01:00Z = lunes 5 de octubre, 8:00 p. m. en Bogotá
    expect(diaLocal("2026-10-06T01:00:00Z")).toBe("2026-10-05");
    expect(horaLocal("2026-10-06T01:00:00Z")).toBe(20);
    expect(diaSemanaLocal("2026-10-06T01:00:00Z")).toBe(0);
  });

  it("el rango cubre el día local completo", () => {
    expect(limitesUtc("2026-10-01", "2026-10-07")).toEqual({
      inicio: "2026-10-01T05:00:00.000Z",
      fin: "2026-10-08T05:00:00.000Z",
    });
  });

  it("la semana empieza el lunes", () => {
    expect(lunesDe("2026-10-07")).toBe("2026-10-05");
    expect(lunesDe("2026-10-05")).toBe("2026-10-05");
    expect(lunesDe("2026-10-11")).toBe("2026-10-05");
  });
});

describe("ventas por fecha", () => {
  const ventas = [venta("v1", "2026-10-01T15:00:00Z", 10000), venta("v2", "2026-10-01T16:00:00Z", 30000), venta("v3", "2026-10-03T15:00:00Z", 20000)];

  it("agrupa por día y deja en cero los días sin ventas", () => {
    const inf = ventasPorFecha(ventas, { desde: "2026-10-01", hasta: "2026-10-03" }, "dia");
    const filas = inf.tablas[0]!.filas;
    expect(filas.map((f) => f.total)).toEqual([40000, 0, 20000]);
    expect(filas.map((f) => f.ventas)).toEqual([2, 0, 1]);
    expect(inf.tablas[0]!.totales?.total).toBe(60000);
    expect(inf.resumen.find((c) => c.rotulo === "Ticket promedio")?.valor).toBe(20000);
  });

  it("agrupa por mes", () => {
    const inf = ventasPorFecha(ventas, { desde: "2026-09-15", hasta: "2026-10-03" }, "mes");
    expect(inf.tablas[0]!.filas.map((f) => [f.periodo, f.total])).toEqual([
      ["septiembre 2026", 0],
      ["octubre 2026", 60000],
    ]);
  });
});

describe("ventas por vendedor", () => {
  it("suma por usuario, separa mostrador y servicio, y ordena de mayor a menor", () => {
    const inf = ventasPorVendedor(
      [venta("v1", "2026-10-01T15:00:00Z", 10000, "u1"), venta("v2", "2026-10-01T15:00:00Z", 50000, "u2", "servicio"), venta("v3", "2026-10-01T15:00:00Z", 20000, "u1")],
      cat,
    );
    const filas = inf.tablas[0]!.filas;
    expect(filas[0]).toMatchObject({ vendedor: "Luis", ventas: 1, servicio: 50000, total: 50000 });
    expect(filas[1]).toMatchObject({ vendedor: "V01 · Ana", rol: "Cajero", ventas: 2, mostrador: 30000, total: 30000, ticket: 15000 });
    expect(filas[0]!.participacion).toBe(62.5);
  });
});

describe("ventas por producto y categoría", () => {
  const items = [
    { venta_id: "v1", repuesto_id: "r1", articulo_id: null, descripcion: "Llanta", cantidad: 2, precio_unit: 50000 },
    { venta_id: "v2", repuesto_id: "r1", articulo_id: null, descripcion: "Llanta", cantidad: 1, precio_unit: 45000 },
    { venta_id: "v3", repuesto_id: null, articulo_id: "a1", descripcion: "Patineta", cantidad: 1, precio_unit: 1200000 },
    { venta_id: "v4", repuesto_id: null, articulo_id: null, descripcion: "Mano de obra", cantidad: 1, precio_unit: 30000 },
  ];

  it("agrupa el mismo repuesto aunque se haya vendido a precios distintos", () => {
    const filas = ventasPorProducto(items, cat).tablas[0]!.filas;
    expect(filas.map((f) => [f.producto, f.unidades, f.total])).toEqual([
      ["Patineta Xiaomi M365", 1, 1200000],
      ['Llanta 10"', 3, 145000],
      ["Mano de obra", 1, 30000],
    ]);
  });

  it("agrupa por categoría, con lo que no tiene ficha aparte", () => {
    const filas = ventasPorCategoria(items, cat).tablas[0]!.filas;
    expect(filas.map((f) => [f.categoria, f.total])).toEqual([
      ["Sin categoría", 1200000],
      ["Llantas", 145000],
      ["Servicios y otros", 30000],
    ]);
  });

  it("la utilidad de artículos es precio menos costo", () => {
    const inf = utilidadArticulos(
      items.map((i) => ({ ...i, creada_en: "2026-10-01T15:00:00Z", creada_por: "u1", numero: 1 })),
      cat,
    );
    expect(inf.tablas[0]!.filas).toHaveLength(1);
    expect(inf.tablas[0]!.filas[0]).toMatchObject({ precio: 1200000, costo: 800000, utilidad: 400000 });
  });
});

describe("horas pico", () => {
  it("encuentra la hora y el día con más ventas en hora local", () => {
    const inf = ventasPorHora([
      venta("v1", "2026-10-06T01:00:00Z", 10000), // lunes 8 p. m.
      venta("v2", "2026-10-06T01:30:00Z", 10000), // lunes 8:30 p. m.
      venta("v3", "2026-10-06T15:00:00Z", 10000), // martes 10 a. m.
    ]);
    expect(inf.resumen.find((c) => c.rotulo === "Hora con más ventas")?.valor).toBe("20:00 – 20:59");
    expect(inf.resumen.find((c) => c.rotulo === "Día más fuerte")?.valor).toBe("Lunes");
  });
});

describe("cierres de caja", () => {
  it("calcula el efectivo esperado con la base y solo los pagos en efectivo", () => {
    const inf = cierresDeCaja(
      [
        {
          id: "t1",
          sede_id: "s1",
          abierto_por: "u1",
          abierto_en: "2026-10-01T13:00:00Z",
          base_inicial: 50000,
          cerrado_por: "u1",
          cerrado_en: "2026-10-01T23:00:00Z",
          efectivo_contado: 145000,
          diferencia: -5000,
        },
      ],
      [
        { turno_id: "t1", monto: 100000, es_efectivo: true },
        { turno_id: "t1", monto: 80000, es_efectivo: false },
      ],
      cat,
    );
    expect(inf.tablas[0]!.filas[0]).toMatchObject({ ventas: 180000, efectivo: 100000, esperado: 150000, contado: 145000, diferencia: -5000 });
    expect(inf.resumen.find((c) => c.rotulo === "Turnos con descuadre")?.valor).toBe(1);
  });
});

describe("filtros de la URL", () => {
  const sedes = [{ id: "s1", nombre: "Local 1" }];
  const ahora = new Date("2026-10-07T18:00:00Z");

  it("por defecto: el mes en curso, todas las sedes, por día", () => {
    const p = leerParametros({}, sedes, ahora);
    expect(p.def.id).toBe("ventas-fecha");
    expect(p.filtro).toEqual({ desde: "2026-10-01", hasta: "2026-10-07", sedeId: null, agrupar: "dia" });
    expect(p.sedeNombre).toBe("Todas las sedes");
  });

  it("ignora una sede que el usuario no puede ver", () => {
    expect(leerParametros({ sede: "otra" }, sedes, ahora).filtro.sedeId).toBeNull();
    expect(leerParametros({ sede: "s1" }, sedes, ahora).filtro.sedeId).toBe("s1");
  });

  it("invierte un rango al revés y descarta fechas inválidas", () => {
    expect(leerParametros({ desde: "2026-10-05", hasta: "2026-10-01" }, sedes, ahora).filtro).toMatchObject({ desde: "2026-10-01", hasta: "2026-10-05" });
    expect(leerParametros({ desde: "2026-02-30" }, sedes, ahora).filtro.desde).toBe("2026-10-01");
  });
});

describe("formato", () => {
  it("muestra fechas en hora de Colombia", () => {
    expect(formatear("2026-10-06T01:05:00Z", "fechaHora")).toBe("05/10/2026 20:05");
    expect(formatear("2026-10-06", "fecha")).toBe("06/10/2026");
    expect(formatear(null, "moneda")).toBe("—");
    expect(formatear("Abierto", "fechaHora")).toBe("Abierto");
  });
});

describe("exportación", () => {
  const inf = ventasPorFecha([venta("v1", "2026-10-01T15:00:00Z", 10000)], { desde: "2026-10-01", hasta: "2026-10-02" }, "dia");
  const enc = { empresa: "Taller de prueba", rango: "01/10/2026 al 02/10/2026", sede: "Todas las sedes", generado: "07/10/2026 13:00 por Ana" };

  it("genera un .xlsx válido", async () => {
    const buf = await informeAExcel(inf, enc);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });

  it("genera un PDF válido", () => {
    const buf = Buffer.from(informeAPdf(inf, enc));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
