import { describe, expect, it } from "vitest";
import { cierreCaja, type CargaCierreCaja } from "./cierre";

const BASE: CargaCierreCaja = {
  aperturaEn: "22/10/2026, 3:39 p. m.",
  cierreEn: "22/10/2026, 7:39 p. m.",
  baseInicial: 300000,
  totalVentas: 886300,
  efectivoEsperado: 1186300,
  efectivoContado: 1186300,
  diferencia: 0,
  empresaNombre: "Taller",
  empresaDireccion: null,
  empresaTelefono: null,
};

const texto = (c: CargaCierreCaja) => cierreCaja(c).toString("latin1");

describe("cierreCaja() -- responsable", () => {
  it("si abrió y cerró la misma persona, una sola línea y su nombre bajo la firma", () => {
    const t = texto({ ...BASE, abiertoPor: "Pepito Perez (Cajero)", cerradoPor: "Pepito Perez (Cajero)" });
    expect(t).toContain("Responsable: Pepito Perez (Cajero)");
    expect(t).not.toMatch(/Abri.:/);
    expect(t).toMatch(/_+\nPepito Perez \(Cajero\)\nFirma responsable/);
  });

  it("si son personas distintas, dice quién abrió y quién cerró", () => {
    const t = texto({ ...BASE, abiertoPor: "Ana (Cajero)", cerradoPor: "Luis (Administrador)" });
    // Las tildes salen en la página de códigos de la impresora, no en latin1.
    expect(t).toMatch(/Abri.:  Ana \(Cajero\)/);
    expect(t).toMatch(/Cerr.:  Luis \(Administrador\)/);
    expect(t).toMatch(/Luis \(Administrador\)\nFirma responsable/);
  });

  it("un trabajo viejo sin nombres sigue imprimiendo", () => {
    const t = texto(BASE);
    expect(t).not.toContain("Responsable:");
    expect(t).toContain("Firma responsable");
  });

  it("apertura y cierre van en líneas separadas", () => {
    const t = texto(BASE);
    expect(t).toContain("Apertura: 22/10/2026, 3:39 p. m.");
    expect(t).toContain("Cierre:   22/10/2026, 7:39 p. m.");
  });
});
