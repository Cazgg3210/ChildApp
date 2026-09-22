import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { env } from "@/shared/config/env";
import { identityService } from "./identity.service";

/**
 * Auth.js v5 configuration.
 *
 * Strategy: JWT sessions (required by the Credentials provider). Global
 * revocation is achieved with `User.sessionVersion`: the token carries the
 * version it was issued with and `getCurrentUser()` rejects stale ones.
 *
 * Additional providers (Google, Apple) are registered when their env vars are
 * present; nothing else in the system depends on the provider used.
 */
function buildProviders(): NextAuthConfig["providers"] {
  const e = env();
  const providers: NextAuthConfig["providers"] = [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        const forwarded = request.headers.get("x-forwarded-for");
        const ip = (forwarded?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
        const user = await identityService.authenticateWithPassword(email, password, ip);
        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ];
  if (e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET) {
    providers.push(Google({ clientId: e.AUTH_GOOGLE_ID, clientSecret: e.AUTH_GOOGLE_SECRET }));
  }
  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env().AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: buildProviders(),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 1;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.sessionVersion = typeof token.sv === "number" ? token.sv : 1;
      return session;
    },
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: env().NODE_ENV === "production",
      },
    },
  },
});
