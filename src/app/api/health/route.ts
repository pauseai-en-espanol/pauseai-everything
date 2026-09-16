import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe. Deliberately does not touch the database so a
 * DB outage surfaces as application errors, not as a pod restart loop.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    sha: process.env.NEXT_PUBLIC_GIT_SHA ?? "unknown",
  });
}
