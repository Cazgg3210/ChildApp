/**
 * The actor performing a request. Resolved once per request by the presentation
 * layer and passed explicitly to application services — never read from globals.
 */
export type Actor =
  | { type: "user"; userId: string; email: string; name: string }
  | { type: "link"; grantId: string; linkId: string; childId: string; recipientName: string }
  | { type: "system" }
  | { type: "anonymous" };

export type UserActor = Extract<Actor, { type: "user" }>;
export type LinkActor = Extract<Actor, { type: "link" }>;

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  locale: string;
  timezone: string;
  emailVerifiedAt: Date | null;
  isDemo: boolean;
  isPlatformAdmin: boolean;
}

export function userActor(user: CurrentUser): UserActor {
  return { type: "user", userId: user.id, email: user.email, name: user.name };
}

export const systemActor: Actor = { type: "system" };
export const anonymousActor: Actor = { type: "anonymous" };

export function actorLabel(actor: Actor): string {
  switch (actor.type) {
    case "user":
      return actor.name;
    case "link":
      return actor.recipientName;
    case "system":
      return "system";
    case "anonymous":
      return "anonymous";
  }
}
