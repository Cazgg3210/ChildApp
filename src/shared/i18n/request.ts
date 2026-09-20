import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, type Locale } from "./locales";

/**
 * next-intl without locale routing: the locale is a cookie (defaults to Spanish).
 * Users switch it from the header; institutions/caregivers inherit it per device.
 */
export default getRequestConfig(async () => {
  let locale: Locale = defaultLocale;
  try {
    const store = await cookies();
    const value = store.get("locale")?.value;
    if (value && isLocale(value)) locale = value;
  } catch {
    // outside a request scope (e.g. build) — keep default
  }
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  return { locale, messages, timeZone: "America/Mexico_City" };
});
