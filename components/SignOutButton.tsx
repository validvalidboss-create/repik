"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton({ locale }: { locale: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: `/${locale}/sign-in` })}
      className="inline-flex items-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
    >
      Вийти
    </button>
  );
}
