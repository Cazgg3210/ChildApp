import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/shared/config/env";
import { metaFromRequest } from "@/shared/http/api-auth";
import { sharingService } from "@/modules/sharing/application/sharing.service";

/**
 * Consume-and-exchange step of a Care Pass opening (no JavaScript required):
 * validates the token, atomically spends one use, audits the opening and
 * issues the signed "seen" cookie, then redirects to the pass. PIN-protected
 * links are consumed only after the PIN cookie is present.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/s/[token]/open">) {
  const { token } = await ctx.params;
  const passUrl = new URL(`/s/${token}`, req.url);
  const store = await cookies();

  const probe = await sharingService.resolveToken(token, { allowExhausted: true });
  if (!probe.ok) return NextResponse.redirect(passUrl);

  const seen = sharingService.isPinCookieValid(probe.link.id, store.get(sharingService.seenCookieName(probe.link.id))?.value);
  if (seen) return NextResponse.redirect(passUrl);
  if (sharingService.requiresPin(probe.link) && !sharingService.isPinCookieValid(probe.link.id, store.get(sharingService.pinCookieName(probe.link.id))?.value)) {
    return NextResponse.redirect(passUrl);
  }

  const opened = await sharingService.consumeOpen(token, metaFromRequest(req));
  passUrl.searchParams.set("opened", "1");
  const res = NextResponse.redirect(passUrl);
  if (opened.ok) {
    res.cookies.set(sharingService.seenCookieName(opened.linkId), opened.seenCookie, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: env().NODE_ENV === "production",
      maxAge: opened.maxAge,
    });
  }
  return res;
}
