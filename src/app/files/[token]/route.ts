import { NextResponse, type NextRequest } from "next/server";
import { LocalDiskStorage, storage } from "@/modules/documents/infrastructure/storage";

/**
 * Serves locally stored private files through signed, expiring tokens.
 * Only used by LocalDiskStorage; S3 issues presigned URLs directly.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/files/[token]">) {
  const { token } = await ctx.params;
  const key = LocalDiskStorage.verifyToken(decodeURIComponent(token));
  if (!key)
    return NextResponse.json({ error: { code: "TOKEN_EXPIRED", message: "This link has expired." } }, { status: 410 });
  const object = await storage().get(key);
  if (!object) return NextResponse.json({ error: { code: "NOT_FOUND", message: "File not found." } }, { status: 404 });
  return new NextResponse(new Uint8Array(object.bytes), {
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.bytes.length),
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "Content-Disposition": "inline",
    },
  });
}
