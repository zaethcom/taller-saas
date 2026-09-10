"use client";

/**
 * Login con correo y contraseña contra Supabase Auth. Al entrar,
 * consulta /api/perfil y redirige según el rol -- un técnico cae en
 * /escanear, un cajero en /vender, admin en /ordenes (ver
 * lib/perfil.ts ATERRIZAJE_POR_ROL).
 *
 * No hay registro propio: los usuarios los crea un admin desde
 * /usuarios (Supabase Auth admin API), porque en este negocio nadie
 * se auto-registra -- el taller da de alta a su gente.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/cliente";

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
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 20 }}>
      <h1>Taller SaaS</h1>
      <form onSubmit={iniciarSesion} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="email"
          placeholder="Correo"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
          style={{ padding: 10 }}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          required
          style={{ padding: 10 }}
        />
        <button type="submit" disabled={enviando} style={{ padding: 10 }}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
        {error && <p style={{ color: "#c0392b" }}>{error}</p>}
      </form>
    </main>
  );
}
