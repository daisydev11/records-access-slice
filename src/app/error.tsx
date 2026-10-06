"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="centered">
      <main className="card stack">
        <h1>Something went wrong on our side</h1>
        <p className="lede">Nothing was changed.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </main>
    </div>
  );
}
