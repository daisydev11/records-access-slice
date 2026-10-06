import Link from "next/link";

export default function NotFound() {
  return (
    <div className="centered">
      <main className="card stack">
        <h1>That page does not exist</h1>
        <Link href="/records">Go to your notes</Link>
      </main>
    </div>
  );
}
