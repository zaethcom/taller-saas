/**
 * Botón «Instalar app» (plan sin internet, fase 0).
 *
 * Chrome y Edge (PC y Android) avisan con `beforeinstallprompt` cuando
 * la app se puede instalar; hay que guardar ese evento y llamarlo
 * después, cuando la persona toca el botón. El evento llega una sola
 * vez y temprano, así que se escucha desde el registro del service
 * worker (componentes/registro-service-worker.tsx) y queda aquí, en un
 * almacén de módulo al que se suscribe el menú del usuario.
 *
 * En iPhone/iPad no existe: allí se instala con Compartir → «Agregar a
 * pantalla de inicio», y el botón simplemente no aparece.
 */

export type EventoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Oyente = (disponible: boolean) => void;

let pendiente: EventoInstalar | null = null;
const oyentes = new Set<Oyente>();

function avisar() {
  for (const o of oyentes) o(pendiente !== null);
}

/** Guarda el evento del navegador; se llama desde `beforeinstallprompt`. */
export function guardarEventoInstalar(evento: EventoInstalar) {
  pendiente = evento;
  avisar();
}

/** Ya quedó instalada (evento `appinstalled`): el botón desaparece. */
export function marcarInstalada() {
  pendiente = null;
  avisar();
}

export function sePuedeInstalar() {
  return pendiente !== null;
}

export function suscribirInstalar(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/**
 * Abre el diálogo de instalación del navegador. Devuelve true si la
 * persona aceptó. El evento solo sirve una vez, acepte o no.
 */
export async function instalarApp(): Promise<boolean> {
  const evento = pendiente;
  if (!evento) return false;
  pendiente = null;
  avisar();
  await evento.prompt();
  const { outcome } = await evento.userChoice;
  return outcome === "accepted";
}
