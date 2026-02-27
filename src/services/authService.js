import { sha256 } from 'js-sha256';

const STORAGE_TOKEN_KEY = "familiez_access_token";
const STORAGE_STATE_KEY = "familiez_oauth_state";
const STORAGE_PKCE_KEY = "familiez_pkce_verifier";
const AUTH_EVENT = "familiez-auth-updated";

const notifyAuthChange = () => {
  window.dispatchEvent(new Event(AUTH_EVENT));
};

// Cookie helpers for OAuth state that persists across redirects
const setCookie = (name, value, maxAgeSeconds = 600) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
};

const getCookie = (name) => {
  const value = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${name}=`))
    ?.split('=')[1];
  return value ? decodeURIComponent(value) : null;
};

const deleteCookie = (name) => {
  document.cookie = `${name}=; path=/; max-age=0`;
};

const getEnv = (name) => {
  const value = import.meta.env[name];
  return value ? String(value).trim() : "";
};

const getAuthConfig = () => {
  return {
    authBaseUrl: getEnv("VITE_SYNOLOGY_AUTH_URL"),
    clientId: getEnv("VITE_CLIENT_ID"),
    redirectUri: getEnv("VITE_REDIRECT_URI"),
    discoveryUrl: getEnv("VITE_SYNOLOGY_DISCOVERY_URL"),
    apiBaseUrl: getEnv("VITE_API_BASE"),
  };
};

const randomString = (length = 32) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

const base64UrlEncode = (str) => {
  // Convert hex string to base64url
  const bytes = str.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const getDiscovery = async () => {
  const { apiBaseUrl, authBaseUrl } = getAuthConfig();
  if (!apiBaseUrl) {
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

  // Fetch discovery from middleware to avoid CORS issues
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/auth/discovery`, { cache: "no-store" });
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
  // Note: Synology SSO doesn't support PKCE, so we won't use code_challenge
  
  // Use cookies instead of localStorage for better cross-domain redirect support
  setCookie(STORAGE_STATE_KEY, state, 600); // 10 minute expiry
  setCookie(STORAGE_PKCE_KEY, codeVerifier, 600);

  // Use known Synology OAuth endpoint (standard for all Synology SSO Server installations)
  const authorizeUrl = `${authBaseUrl.replace(/\/$/, "")}/webman/sso/SSOOauth.cgi`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state,
    // Synology doesn't support PKCE, so we don't include code_challenge parameters
  });

  const authUrl = `${authorizeUrl}?${params.toString()}`;
  window.location.assign(authUrl);
};

export const exchangeCodeForToken = async (code, state) => {
  const { apiBaseUrl } = getAuthConfig();
  if (!apiBaseUrl) {
    throw new Error("Missing VITE_API_BASE env");
  }

  const expectedState = getCookie(STORAGE_STATE_KEY);

  if (!expectedState) {
    throw new Error("Invalid OAuth state - state not found in storage");
  }

  if (state !== expectedState) {
    throw new Error("Invalid OAuth state - state mismatch");
  }
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/auth/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    throw new Error("Token exchange failed");
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error("Token response missing access_token");
  }

  // Clean up OAuth cookies
  deleteCookie(STORAGE_STATE_KEY);
  deleteCookie(STORAGE_PKCE_KEY);
  
  // Store access token in localStorage
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
