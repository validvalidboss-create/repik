"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "tutor">("student");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <main className="container mx-auto px-4 py-16 max-w-md">
      <h1 className="text-2xl font-semibold mb-6">Вхід / реєстрація</h1>
      <div className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ім'я (як вас звати?)"
          className="w-full border rounded px-3 py-2"
        />
        <div className="space-y-2 text-sm">
          <div className="font-medium">Хто ви?</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`border rounded px-3 py-2 text-left ${role === "student" ? "border-black bg-black text-white" : "bg-white"}`}
            >
              Учень
            </button>
            <button
              type="button"
              onClick={() => setRole("tutor")}
              className={`border rounded px-3 py-2 text-left ${role === "tutor" ? "border-black bg-black text-white" : "bg-white"}`}
            >
              Викладач
            </button>
          </div>
        </div>
        <button
          onClick={async () => {
            setErr(null);
            try {
              const trimmedEmail = email.trim();
              const trimmedName = name.trim();

              if (!trimmedEmail) {
                setErr("Вкажіть email");
                return;
              }
              if (!trimmedName) {
                setErr("Вкажіть ім'я");
                return;
              }

              const locale = pathname?.split("/")?.[1] || "uk";

              const res = await signIn("credentials", {
                email: trimmedEmail,
                name: trimmedName,
                role,
                redirect: false,
              });

              if (res?.error) {
                setErr(res.error);
                return;
              }

              let isAdmin = false;
              try {
                const me = await fetch("/api/me", { cache: "no-store" });
                const meJson = await me.json().catch(() => ({} as any));
                isAdmin = !!meJson?.isAdmin;
              } catch {
                // ignore
              }

              const targetPath = isAdmin
                ? `/${locale}/admin/tutors`
                : `/${locale}/profile`;

              const next = String(searchParams?.get("next") || "").trim();
              const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("..") ? next : "";
              router.push(safeNext || targetPath);
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
          className="w-full bg-black text-white px-4 py-2 rounded"
        >
          Continue
        </button>
        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>
    </main>
  );
}
