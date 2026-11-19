/**
 * Pantalla de taller: una empresa sin taller (0072) va a Vender.
 * Ver lib/taller-activo.ts.
 */
import { exigirTaller } from "@/lib/taller-activo";

export default async function LayoutSoloConTaller({ children }: { children: React.ReactNode }) {
  await exigirTaller();
  return children;
}
