import Link from "next/link";

export default function Inicio() {
  return (
    <main style={{ padding: 40, maxWidth: 640, margin: "0 auto" }}>
      <h1>Taller SaaS</h1>
      <p>Tres puertas, un solo sistema.</p>
      <ul>
        <li>
          <Link href="/pos">POS — caja de las dos sedes</Link>
        </li>
        <li>
          <Link href="/taller">Taller — la app del técnico</Link>
        </li>
        <li>
          <Link href="/admin/ordenes">Admin — tablero de órdenes</Link>
        </li>
      </ul>
    </main>
  );
}
