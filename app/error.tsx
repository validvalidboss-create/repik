"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-3">Сталася помилка</h1>
      <p className="text-sm text-neutral-600 mb-4">Спробуйте оновити сторінку або перезапустити дію.</p>
      <pre className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3 overflow-auto mb-4">
        {String(error?.message || error)}
      </pre>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Спробувати ще раз
      </button>
    </main>
  );
}
