"use client";

/**
 * Login con correo y contraseña contra Supabase Auth. Al entrar,
 * consulta /api/perfil y redirige según el rol -- un técnico cae en
 * /escanear, un cajero en /vender, admin en /ordenes (ver
 * lib/perfil.ts ATERRIZAJE_POR_ROL).
 *
 * No hay registro propio: los usuarios los crea un admin desde
 * /usuarios (Supabase Auth admin API), porque en este negocio nadie
 * se auto-registra -- el taller da de alta a su gente. Por eso la
 * pantalla no ofrece "crear cuenta" ni "recuperar contraseña": las dos
 * llevarían a un callejón sin salida.
 *
 * Es la única pantalla con sesión cerrada, así que no puede saber de
 * qué empresa se trata: va sobre el negro de la plataforma, sin color
 * de marca.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/ui/boton";
import { Campo, Aviso } from "@/componentes/ui/campo";

export default function PaginaLogin() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: errAuth } = await supabase.auth.signInWithPassword({
      email: correo,
      password: clave,
    });

    if (errAuth) {
      setError("Correo o contraseña incorrectos.");
      setEnviando(false);
      return;
    }

    const res = await fetch("/api/perfil");
    if (!res.ok) {
      // No tiene perfil en ninguna empresa -- puede ser, en cambio, un
      // superadmin de la plataforma (esos no pertenecen a ninguna).
      const resSuperadmin = await fetch("/api/superadmin/yo");
      if (resSuperadmin.ok) {
        router.push("/superadmin/empresas");
        router.refresh();
        return;
      }
      setError("Tu usuario no está activo. Habla con un administrador.");
      await supabase.auth.signOut();
      setEnviando(false);
      return;
    }

    const perfil = await res.json();
    const destinos: Record<string, string> = {
      admin: "/ordenes",
      recepcion: "/vender",
      tecnico: "/escanear",
      compras: "/compras",
      cajero: "/vender",
    };
    router.push(destinos[perfil.rol] ?? "/");
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "var(--chrome)",
        backgroundImage: "linear-gradient(160deg, var(--chrome-2) 0%, var(--chrome) 48%, #000 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 28,
          borderRadius: "var(--r-lg)",
          background: "#fff",
          boxShadow: "0 30px 60px -30px rgba(0,0,0,0.9)",
        }}
      >
        <div style={{ marginBottom: 22 }}>
          <div className="marca" style={{ fontSize: 26, color: "#131417", lineHeight: 1 }}>
            Taller SaaS
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7078" }}>
            POS y servicio técnico trazable por QR.
          </p>
        </div>

        <form onSubmit={iniciarSesion} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Campo etiqueta="Correo">
            <input
              type="email"
              placeholder="tu@taller.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
              autoComplete="username"
            />
          </Campo>
          <Campo etiqueta="Contraseña">
            <input
              type="password"
              placeholder="••••••••"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Campo>
          <Boton
            type="submit"
            variante="primario"
            tamano="lg"
            ancho
            icono={<LogIn size={19} strokeWidth={2} />}
            disabled={enviando}
          >
            {enviando ? "Entrando…" : "Entrar"}
          </Boton>
          {error && <Aviso tono="peligro">{error}</Aviso>}
        </form>

        <p style={{ margin: "18px 0 0", fontSize: 12, color: "#9297a0", textAlign: "center" }}>
          Las cuentas las crea un administrador del taller.
        </p>
      </div>
    </main>
  );
}
