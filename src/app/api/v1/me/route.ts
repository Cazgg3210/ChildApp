import { apiHandler } from "@/shared/http/api";
import { requireApiUser } from "@/shared/http/api-auth";
import { getCurrentUser } from "@/modules/identity/application/session";

export const GET = apiHandler(async () => {
  await requireApiUser();
  const user = await getCurrentUser();
  return { user };
});
