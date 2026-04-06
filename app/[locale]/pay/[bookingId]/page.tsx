import { prisma } from "@/lib/prisma";
import { buildFondyPaymentPayload, isFondyConfigured } from "@/lib/payments/fondy";

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; bookingId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await params;
  const sp = searchParams ? await searchParams : undefined;
  const devError = sp ? String((sp as any)?.dev_error || "").trim() : "";
  if (!p?.bookingId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-semibold mb-6">Оплата</h1>

        {devError ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            DEV: не вдалося підтвердити бронювання ({devError}). Перевір підключення до бази даних і перезапусти dev-сервер.
          </div>
        ) : null}

        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="text-base font-semibold text-neutral-900">Booking ID відсутній</div>
          <div className="mt-2 text-sm text-neutral-600">Відкрий сторінку оплати у форматі /{p?.locale || "uk"}/pay/&lt;bookingId&gt;.</div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`/${p?.locale || "uk"}/catalog`}
              className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Перейти в каталог
            </a>
          </div>
        </div>
      </main>
    );
  }
  const booking = await prisma.booking.findUnique({ where: { id: p.bookingId } });
  if (!booking) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-semibold mb-6">Оплата</h1>

        {devError ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            DEV: не вдалося підтвердити бронювання ({devError}). Перевір підключення до бази даних і перезапусти dev-сервер.
          </div>
        ) : null}

        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="text-base font-semibold text-neutral-900">Booking not found</div>
          <div className="mt-2 text-sm text-neutral-600">
            ID: <span className="font-mono">{p.bookingId}</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`/${p.locale}/catalog`}
              className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Перейти в каталог
            </a>
          </div>
        </div>
      </main>
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const payload = buildFondyPaymentPayload({
    order_id: booking.id,
    amount: booking.priceCents,
    currency: booking.currency,
    order_desc: `Booking ${booking.id}`,
    response_url: `${baseUrl}/${p.locale}/payment/${booking.id}`,
    server_callback_url: `${baseUrl}/api/payments/fondy/callback`,
  });

  const fondyUrl = "https://pay.fondy.eu/api/checkout/redirect/";
  const configured = isFondyConfigured();

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold mb-6">Оплата</h1>

      {devError ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          DEV: не вдалося підтвердити бронювання ({devError}). Перевір підключення до бази даних і перезапусти dev-сервер.
        </div>
      ) : null}

      {!configured ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="text-base font-semibold text-neutral-900">Платіж поки недоступний</div>
          <div className="mt-2 text-sm text-neutral-600">
            Fondy не налаштовано. Додайте <span className="font-mono">FONDY_MERCHANT_ID</span> та <span className="font-mono">FONDY_SECRET</span> у <span className="font-mono">.env</span>,
            щоб увімкнути оплату.
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`/${p.locale}/book/${booking.tutorId}`}
              className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Назад до бронювання
            </a>

            <form method="POST" action={`/api/bookings/${booking.id}/dev-confirm`}>
              <input type="hidden" name="locale" value={p.locale} />
              <button type="submit" className="h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800">
                DEV: підтвердити і перейти до уроку
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="text-sm text-neutral-600">Сума до сплати</div>
          <div className="mt-1 text-2xl font-semibold text-neutral-900">
            {(booking.priceCents / 100).toFixed(0)} {booking.currency}
          </div>
          <form method="POST" action={fondyUrl} className="mt-6">
            {Object.entries(payload).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={String(v)} />
            ))}
            <button type="submit" className="h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-neutral-800">
              Перейти до оплати
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
