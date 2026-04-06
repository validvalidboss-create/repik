import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-3">Сторінку не знайдено</h1>
      <p className="text-sm text-neutral-600 mb-6">Перевірте посилання або поверніться на головну.</p>
      <Link
        href="/"
        className="inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        На головну
      </Link>
    </main>
  );
}
