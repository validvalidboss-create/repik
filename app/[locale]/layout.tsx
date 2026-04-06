import "../globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { isLocale, Locale, defaultLocale } from "@/lib/i18n";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Repetitir",
  description: "Premium tutoring marketplace",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const selectedLocale: Locale = isLocale(locale)
    ? (locale as Locale)
    : defaultLocale;

  const session = await auth();
  const viewer = session?.user as any;
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim();
  const isAdmin =
    !!adminEmail && !!viewer?.email && String(viewer.email).toLowerCase() === String(adminEmail).toLowerCase();

  return (
    <Providers session={session}>
      <Header isAdmin={isAdmin} />
      {children}
    </Providers>
  );
}
