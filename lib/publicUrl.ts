type PublicUrlEnv = {
  PUBLIC_APP_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
};

export function createDeliveryUrl(
  token: string,
  requestUrl: string,
  env: PublicUrlEnv = {
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  },
) {
  const configuredOrigin = env.PUBLIC_APP_URL?.trim();
  const productionHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const baseUrl = configuredOrigin || (productionHost ? `https://${productionHost}` : new URL(requestUrl).origin);
  const url = new URL(baseUrl);
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (
    (url.protocol !== "https:" && !(localHost && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new Error("The public app URL must be an HTTPS origin without a path, query, or credentials.");
  }

  return new URL(`/d/${encodeURIComponent(token)}`, url.origin).toString();
}
