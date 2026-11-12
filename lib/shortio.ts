import { createDeliveryUrl } from "./publicUrl";

type ShortIoEnv = {
  PUBLIC_APP_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  SHORTIO_API_KEY?: string;
  SHORTIO_DOMAIN?: string;
};

type ShortIoResponse = { shortURL?: unknown };

export async function createDeliveryShareUrl(
  token: string,
  requestUrl: string,
  env: ShortIoEnv = {
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    SHORTIO_API_KEY: process.env.SHORTIO_API_KEY,
    SHORTIO_DOMAIN: process.env.SHORTIO_DOMAIN,
  },
  request: typeof fetch = fetch,
) {
  const originalUrl = createDeliveryUrl(token, requestUrl, env);
  const apiKey = env.SHORTIO_API_KEY?.trim();
  const domain = env.SHORTIO_DOMAIN?.trim().toLowerCase();

  if (!apiKey || !domain) {
    return {
      url: originalUrl,
      shortened: false,
      shorteningWarning: "Short.io is not configured yet. Add SHORTIO_API_KEY and SHORTIO_DOMAIN in Vercel to shorten links automatically.",
    };
  }

  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) {
    return {
      url: originalUrl,
      shortened: false,
      shorteningWarning: "Short.io's domain setting is invalid. Check SHORTIO_DOMAIN in Vercel.",
    };
  }

  try {
    const response = await request("https://api.short.io/links", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ originalURL: originalUrl, domain, allowDuplicates: false }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`Short.io link creation failed with HTTP ${response.status}.`);
      return {
        url: originalUrl,
        shortened: false,
        shorteningWarning: `Short.io could not shorten this link (HTTP ${response.status}); the full private link is available below.`,
      };
    }

    const body = await response.json() as ShortIoResponse;
    if (typeof body.shortURL !== "string") {
      console.error("Short.io returned an invalid link response.");
      return {
        url: originalUrl,
        shortened: false,
        shorteningWarning: "Short.io returned an invalid response; the full private link is available below.",
      };
    }

    const shortUrl = new URL(body.shortURL);
    if (shortUrl.protocol !== "https:" || shortUrl.hostname.toLowerCase() !== domain || shortUrl.username || shortUrl.password) {
      console.error("Short.io returned a link outside the configured HTTPS domain.");
      return {
        url: originalUrl,
        shortened: false,
        shorteningWarning: "Short.io returned an unexpected domain; the full private link is available below.",
      };
    }

    return { url: shortUrl.toString(), shortened: true };
  } catch {
    console.error("Short.io link creation could not be completed.");
    return {
      url: originalUrl,
      shortened: false,
      shorteningWarning: "Short.io is temporarily unavailable; the full private link is available below.",
    };
  }
}
