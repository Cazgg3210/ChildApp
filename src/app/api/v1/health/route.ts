import { NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";

/** Liveness/readiness probe for container orchestrators. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503 });
  }
}
