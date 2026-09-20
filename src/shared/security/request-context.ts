import { headers } from "next/headers";

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

/** Best-effort client metadata for audit events. Never trusted for authorization. */
export async function getRequestMeta(): Promise<RequestMeta> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ipAddress = (forwarded?.split(",")[0] ?? h.get("x-real-ip") ?? undefined)?.trim();
    const userAgent = h.get("user-agent") ?? undefined;
    return { ipAddress, userAgent: userAgent?.slice(0, 512) };
  } catch {
    return {};
  }
}
