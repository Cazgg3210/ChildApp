import { apiHandler } from "@/shared/http/api";
import { requireApiUser } from "@/shared/http/api-auth";
import { consentService } from "@/modules/consent/application/consent.service";

/** The guardian's consent ledger (append-only). */
export const GET = apiHandler(async () => {
  const { userId } = await requireApiUser();
  const consents = await consentService.listForGuardian(userId);
  return { consents };
});
