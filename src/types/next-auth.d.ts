import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    sessionVersion: number;
    user: { id: string } & DefaultSession["user"];
  }
  interface User {
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sv?: number;
  }
}
