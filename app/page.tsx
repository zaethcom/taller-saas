import Link from "next/link";

export default function Inicio() {
  return (
    <main style={{ padding: 40, maxWidth: 640, margin: "0 auto" }}>
      <h1>Taller SaaS</h1>
      <p>Tres puertas, un solo sistema.</p>
      <ul>
        <li>
          <Link href="/vender">POS — caja de las dos sedes</Link>
        </li>
        <li>
          <Link href="/escanear">Taller — la app del técnico</Link>
        </li>
        <li>
          <Link href="/ordenes">Admin — tablero de órdenes</Link>
        </li>
      </ul>
    </main>
  );
}
