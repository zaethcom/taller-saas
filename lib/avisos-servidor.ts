/**
 * Crear un aviso para el taller (0061_avisos_cliente.sql) y mandarlo
 * por push a los equipos que lo activaron. Lo llaman las rutas públicas
 * del enlace de seguimiento con el cliente admin (sin sesión detrás), y
 * Compras al recibir un repuesto (ese push va solo al técnico).
 *
 * Nada de esto puede tumbar lo que hizo el cliente: si la tabla todavía
 * no existe (migración sin correr), faltan las llaves VAPID o un push
 * falla, el mensaje o la aprobación ya quedaron guardados y se sigue.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { esDelCliente, notificacionDeAviso, textoAviso, urlAviso, veAvisos, type TipoAviso } from "./avisos";
import { ATERRIZAJE_POR_ROL } from "./perfil";
import { puede, type Rol } from "./permisos";

/** Las tres variables de entorno de Vercel que activan el push; sin ellas solo queda el globo. */
export function configuracionPush(): { publica: string; privada: string; contacto: string } | null {
  const publica = process.env.VAPID_PUBLIC_KEY?.trim();
  const privada = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publica || !privada) return null;
  const contacto = process.env.VAPID_SUBJECT?.trim() || "mailto:soporte@taller-saas.app";
  return { publica, privada, contacto };
}

export async function crearAviso(
  admin: SupabaseClient,
  a: { empresaId: string; ordenId: string; tipo: TipoAviso; detalle?: string | null },
): Promise<void> {
  try {
    const { data: orden } = await admin
      .from("orden")
      .select("sede_id, numero, tecnico_id, producto:producto_id ( cliente:cliente_id ( nombre ) )")
      .eq("id", a.ordenId)
      .maybeSingle();
    const sedeId = (orden?.sede_id as string | null) ?? null;
    const texto = textoAviso(a.tipo, a.detalle);

    const { error } = await admin.from("aviso").insert({
      empresa_id: a.empresaId,
      sede_id: sedeId,
      orden_id: a.ordenId,
      tipo: a.tipo,
      texto,
    });
    if (error) return;

    const producto = orden?.producto as unknown as { cliente: { nombre: string } | null } | null;
    await enviarPush(admin, {
      empresaId: a.empresaId,
      sedeId,
      tipo: a.tipo,
      texto,
      ordenId: a.ordenId,
      numero: (orden?.numero as number | null) ?? null,
      cliente: producto?.cliente?.nombre ?? null,
      tecnicoId: (orden?.tecnico_id as string | null) ?? null,
    });
  } catch {
    // Ver el comentario de arriba: el aviso es un extra.
  }
}

async function enviarPush(
  admin: SupabaseClient,
  a: {
    empresaId: string;
    sedeId: string | null;
    tipo: TipoAviso;
    texto: string;
    ordenId: string;
    numero: number | null;
    cliente: string | null;
    tecnicoId: string | null;
  },
): Promise<void> {
  const config = configuracionPush();
  if (!config) return;
  webpush.setVapidDetails(config.contacto, config.publica, config.privada);

  let consulta = admin
    .from("push_suscripcion")
    .select("id, endpoint, p256dh, auth, perfil_id, perfil:perfil_id ( rol, activo )")
    .eq("empresa_id", a.empresaId);
  if (a.sedeId) consulta = consulta.or(`sede_id.is.null,sede_id.eq.${a.sedeId}`);
  const { data: suscripciones } = await consulta;

  await Promise.all(
    (suscripciones ?? []).map(async (s) => {
      const perfil = s.perfil as unknown as { rol: Rol; activo: boolean } | null;
      if (!perfil?.activo || !veAvisos(perfil.rol)) return;
      // Lo que genera el taller (llegó un repuesto) es para quien repara:
      // el técnico de la orden o, si no tiene, los que diagnostican.
      if (!esDelCliente(a.tipo)) {
        if (a.tecnicoId ? s.perfil_id !== a.tecnicoId : !puede(perfil.rol, "diagnosticar")) return;
      }
      const notificacion = notificacionDeAviso({
        ...a,
        url: urlAviso(perfil.rol, a.ordenId, ATERRIZAJE_POR_ROL[perfil.rol], a.tipo),
      });
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(notificacion),
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
      } catch (e) {
        // 404/410: el navegador dio de baja la suscripción (desinstalaron,
        // borraron datos o quitaron el permiso). No se vuelve a intentar.
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) {
          await admin.from("push_suscripcion").delete().eq("id", s.id);
        }
      }
    }),
  );
}
