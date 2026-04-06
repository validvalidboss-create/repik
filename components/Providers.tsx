"use client";
import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

export default function Providers({
  children,
  session,
}: {
  children: ReactNode;
  session?: any;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
