import { NextResponse } from "next/server";
import { auth } from "@/modules/identity/application/auth";

/**
 * Coarse gate only: unauthenticated users are sent to /login for the private
 * areas. Real authorization (which child, which category, which capability)
 * always happens in AuthorizationService inside the application services.
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isPrivate = pathname.startsWith("/app") || pathname.startsWith("/institution");
  if (isPrivate && !req.auth?.user?.id) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*", "/institution/:path*"],
};
