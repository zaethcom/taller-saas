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
 * qué empresa se trata SOLO con la URL -- por eso pide primero un
 * "código de acceso" (empresa.codigo, configurable en /configuracion)
 * y resuelve con él, sin sesión, el logo/color/eslogan/fondo de esa
 * empresa vía /api/empresas/por-codigo -- la misma idea que el token
 * público de /seguimiento, pero para branding en vez de una orden.
 * Sin código (o mientras no coincide con ninguna empresa), se ve
 * genérica sobre el negro de la plataforma, como siempre.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Check } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/ui/boton";
import { Campo, Aviso } from "@/componentes/ui/campo";

interface MarcaEmpresa {
  nombre: string;
  logoUrl: string | null;
  colorPrincipal: string | null;
  eslogan: string | null;
  fondoLoginUrl: string | null;
}

const CLAVE_LOCAL = "taller-saas:codigo-empresa";

export default function PaginaLogin() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [codigo, setCodigo] = useState("");
  const [marca, setMarca] = useState<MarcaEmpresa | null>(null);
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState(false);
  const codigoInicializado = useRef(false);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_LOCAL);
      if (guardado) setCodigo(guardado);
    } catch {
      // Navegación privada o storage bloqueado: se sigue sin código.
    }
    codigoInicializado.current = true;
  }, []);

  useEffect(() => {
    if (!codigoInicializado.current) return;
    const texto = codigo.trim().toLowerCase();
    if (texto.length < 3) {
      setMarca(null);
      setCodigoNoEncontrado(false);
      return;
    }
    const controlador = new AbortController();
    const temporizador = setTimeout(() => {
      fetch(`/api/empresas/por-codigo?codigo=${encodeURIComponent(texto)}`, { signal: controlador.signal })
        .then(async (r) => {
          if (!r.ok) {
            setMarca(null);
            setCodigoNoEncontrado(true);
            return;
          }
          setMarca(await r.json());
          setCodigoNoEncontrado(false);
          try {
            localStorage.setItem(CLAVE_LOCAL, texto);
          } catch {
            // Sin persistencia -- no es grave, solo toca escribirlo de nuevo.
          }
        })
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [codigo]);

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
        background: marca?.fondoLoginUrl
          ? `linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.75)), #000 url(${marca.fondoLoginUrl}) center/cover no-repeat`
          : "var(--chrome)",
        backgroundImage: marca?.fondoLoginUrl
          ? undefined
          : "linear-gradient(160deg, var(--chrome-2) 0%, var(--chrome) 48%, #000 100%)",
      }}
    >
      <div
        style={{ "--accent": marca?.colorPrincipal || "#0b6c78" } as React.CSSProperties}
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
            {marca?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={marca.logoUrl} alt={marca.nombre} style={{ maxHeight: 52, maxWidth: "100%", objectFit: "contain" }} />
            ) : (
              <div className="marca" style={{ fontSize: 26, color: "#131417", lineHeight: 1 }}>
                {marca?.nombre ?? "Taller SaaS"}
              </div>
            )}
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7078" }}>
              {marca?.eslogan || "POS y servicio técnico trazable por QR."}
            </p>
          </div>

          <form onSubmit={iniciarSesion} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Campo
              etiqueta="Código de tu taller"
              ayuda={
                marca
                  ? undefined
                  : codigoNoEncontrado
                    ? "No encontramos ese código -- puedes seguir e iniciar sesión igual."
                    : "El código corto que te dio tu administrador. Opcional para entrar, pero personaliza esta pantalla."
              }
            >
              <input
                placeholder="ej. polaco-scooter"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="cifra"
                autoCapitalize="none"
                autoCorrect="off"
              />
              {marca && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--ok)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Check size={13} strokeWidth={2.4} /> {marca.nombre}
                </div>
              )}
            </Campo>
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
      </div>
    </main>
  );
}
