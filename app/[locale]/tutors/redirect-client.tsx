"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function ClientRedirect({ locale }: { locale: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const uid = sp.get("uid");
    if (uid) {
      // Push to the canonical dynamic route
      router.replace(`/${locale}/tutors/${encodeURIComponent(uid)}`);
    }
  }, [sp, router, locale]);

  return null;
}
