import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale, locales } from "./lib/i18n";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/assets") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  const maybeLocale = segments[0];
  if (!maybeLocale || !isLocale(maybeLocale)) {
    const locale = request.cookies.get("LOCALE")?.value || defaultLocale;
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.cookies.set("LOCALE", maybeLocale);
  return response;
}

export const config = {
  matcher: ["/:path*"],
};
