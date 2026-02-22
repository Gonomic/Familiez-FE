const STORAGE_TOKEN_KEY = "familiez_access_token";
const STORAGE_STATE_KEY = "familiez_oauth_state";
const STORAGE_PKCE_KEY = "familiez_pkce_verifier";
const AUTH_EVENT = "familiez-auth-updated";

const notifyAuthChange = () => {
  window.dispatchEvent(new Event(AUTH_EVENT));
};

const getEnv = (name) => {
  const value = import.meta.env[name];
  return value ? String(value).trim() : "";
};

const getAuthConfig = () => ({
  authBaseUrl: getEnv("VITE_SYNOLOGY_AUTH_URL"),
  clientId: getEnv("VITE_CLIENT_ID"),
  redirectUri: getEnv("VITE_REDIRECT_URI"),
  discoveryUrl: getEnv("VITE_SYNOLOGY_DISCOVERY_URL"),
  apiBaseUrl: getEnv("VITE_API_BASE"),
});

const randomString = (length = 32) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

const sha256 = async (plain) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
};

const base64UrlEncode = (buffer) =>
  btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const getDiscovery = async () => {
  const { discoveryUrl, authBaseUrl } = getAuthConfig();
  if (!discoveryUrl) {
    return null;
  }

  const cacheKey = "familiez_oidc_discovery";
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      sessionStorage.removeItem(cacheKey);
    }
  }

  const response = await fetch(discoveryUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to fetch OIDC discovery document");
  }

  const discovery = await response.json();
  if (!discovery.authorization_endpoint && authBaseUrl) {
    discovery.authorization_endpoint = `${authBaseUrl.replace(/\/$/, "")}/oauth/authorize`;
  }

  sessionStorage.setItem(cacheKey, JSON.stringify(discovery));
  return discovery;
};

export const initiateSSOLogin = async () => {
  const { authBaseUrl, clientId, redirectUri } = getAuthConfig();
  if (!authBaseUrl || !clientId || !redirectUri) {
    throw new Error("Missing SSO configuration in env");
  }

  const state = randomString(24);
  const codeVerifier = randomString(64);
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));

  sessionStorage.setItem(STORAGE_STATE_KEY, state);
  sessionStorage.setItem(STORAGE_PKCE_KEY, codeVerifier);

  const discovery = await getDiscovery();
  const authorizeUrl = discovery?.authorization_endpoint
    ? discovery.authorization_endpoint
    : `${authBaseUrl.replace(/\/$/, "")}/oauth/authorize`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  window.location.assign(`${authorizeUrl}?${params.toString()}`);
};

export const exchangeCodeForToken = async (code, state) => {
  const { apiBaseUrl } = getAuthConfig();
  if (!apiBaseUrl) {
    throw new Error("Missing VITE_API_BASE env");
  }

  const expectedState = sessionStorage.getItem(STORAGE_STATE_KEY);
  if (!expectedState || state !== expectedState) {
    throw new Error("Invalid OAuth state");
  }

  const codeVerifier = sessionStorage.getItem(STORAGE_PKCE_KEY);
  if (!codeVerifier) {
    throw new Error("Missing PKCE verifier");
  }

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/auth/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, codeVerifier }),
  });

  if (!response.ok) {
    throw new Error("Token exchange failed");
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Token response missing access_token");
  }

  sessionStorage.removeItem(STORAGE_STATE_KEY);
  sessionStorage.removeItem(STORAGE_PKCE_KEY);
  localStorage.setItem(STORAGE_TOKEN_KEY, data.access_token);
  notifyAuthChange();
  return data.access_token;
};

export const getStoredToken = () => localStorage.getItem(STORAGE_TOKEN_KEY);

export const clearStoredToken = () => {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  notifyAuthChange();
};

export const setAuthHeader = (token) => ({
  Authorization: `Bearer ${token}`,
});
