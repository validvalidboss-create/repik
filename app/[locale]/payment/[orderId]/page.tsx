"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PaymentResultPage() {
  const params = useParams<{ locale: string; orderId: string }>();
  const [status, setStatus] = useState<string>("pending");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        try {
          await fetch(`/api/bookings/${params.orderId}/confirm-after-payment`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
        } catch {
          // ignore
        }

        const res = await fetch(`/api/bookings/${params.orderId}`);
        if (!res.ok) {
          setStatus("unknown");
          return;
        }
        const data = await res.json();
        setStatus(String(data.booking?.status || "PENDING").toLowerCase());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="container mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-4">Payment Result</h1>
      <p className="text-sm text-muted-foreground mb-6">Order ID: {params.orderId}</p>
      <div className="p-4 border rounded bg-neutral-50 mb-6">
        <div className="font-medium mb-2">Status</div>
        <div>{loading ? "Checking..." : status}</div>
      </div>
      {!loading && (status === "confirmed" || status === "completed") && (
        <a
          href={`/${params.locale}/lesson/${params.orderId}`}
          className="inline-block bg-black text-white px-6 py-2 rounded"
        >
          Go to lesson
        </a>
      )}
      {!loading && !(status === "confirmed" || status === "completed") && (
        <div className="text-sm text-muted-foreground">Once the payment is confirmed, a link to the lesson will appear here.</div>
      )}
    </main>
  );
}
