import { sha256 } from 'js-sha256';

const STORAGE_TOKEN_KEY = "familiez_access_token";
const STORAGE_STATE_KEY = "familiez_oauth_state";
const STORAGE_PKCE_KEY = "familiez_pkce_verifier";
const STORAGE_STATE_FALLBACK_KEY = "familiez_oauth_state_fallback";
const STORAGE_PKCE_FALLBACK_KEY = "familiez_pkce_verifier_fallback";
const STORAGE_USER_ROLE_KEY = "familiez_user_role";
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
    prompt: getEnv("VITE_SYNOLOGY_LOGIN_PROMPT") || "login",
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
  const { authBaseUrl, clientId, redirectUri, prompt } = getAuthConfig();
  if (!authBaseUrl || !clientId || !redirectUri) {
    throw new Error("Missing SSO configuration in env");
  }

  // Ensure a clean local auth state before starting a new login
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_USER_ROLE_KEY);

  const state = randomString(24);
  const codeVerifier = randomString(64);
  // Note: Synology SSO doesn't support PKCE, so we won't use code_challenge
  
  // Use both cookies AND sessionStorage for maximum compatibility across redirects
  setCookie(STORAGE_STATE_KEY, state, 600); // 10 minute expiry
  setCookie(STORAGE_PKCE_KEY, codeVerifier, 600);
  sessionStorage.setItem(STORAGE_STATE_KEY, state);
  sessionStorage.setItem(STORAGE_PKCE_KEY, codeVerifier);
  localStorage.setItem(STORAGE_STATE_FALLBACK_KEY, state);
  localStorage.setItem(STORAGE_PKCE_FALLBACK_KEY, codeVerifier);

  // Use known Synology OAuth endpoint (standard for all Synology SSO Server installations)
  const authorizeUrl = `${authBaseUrl.replace(/\/$/, "")}/webman/sso/SSOOauth.cgi`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email",
    state,
    prompt,
    max_age: "0",
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

  // Try cookie first, then sessionStorage as fallback
  const expectedState =
    getCookie(STORAGE_STATE_KEY) ||
    sessionStorage.getItem(STORAGE_STATE_KEY) ||
    localStorage.getItem(STORAGE_STATE_FALLBACK_KEY);

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

  // Clean up OAuth cookies and sessionStorage
  deleteCookie(STORAGE_STATE_KEY);
  deleteCookie(STORAGE_PKCE_KEY);
  sessionStorage.removeItem(STORAGE_STATE_KEY);
  sessionStorage.removeItem(STORAGE_PKCE_KEY);
  localStorage.removeItem(STORAGE_STATE_FALLBACK_KEY);
  localStorage.removeItem(STORAGE_PKCE_FALLBACK_KEY);
  
  // Store access token in localStorage
  localStorage.setItem(STORAGE_TOKEN_KEY, data.access_token);
  notifyAuthChange();
  return data.access_token;
};

export const getStoredToken = () => localStorage.getItem(STORAGE_TOKEN_KEY);

export const clearStoredToken = () => {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_USER_ROLE_KEY);
  sessionStorage.removeItem(STORAGE_STATE_KEY);
  sessionStorage.removeItem(STORAGE_PKCE_KEY);
  deleteCookie(STORAGE_STATE_KEY);
  deleteCookie(STORAGE_PKCE_KEY);
  localStorage.removeItem(STORAGE_STATE_FALLBACK_KEY);
  localStorage.removeItem(STORAGE_PKCE_FALLBACK_KEY);
  notifyAuthChange();
};

// Logout - keep user in the same tab on Familiez login page.
// Also clear Synology session in the background (no popup, no redirect).
export const initiateSSOLogout = () => {
  clearStoredToken();

  const { authBaseUrl } = getAuthConfig();
  const logoutBase = (authBaseUrl || '').replace(/\/$/, '');
  const synologyApiLogoutUrl = `${logoutBase}/webapi/auth.cgi?api=SYNO.API.Auth&method=logout&version=7`;

  try {
    fetch(synologyApiLogoutUrl, {
      method: 'GET',
      mode: 'no-cors',
      credentials: 'include',
      cache: 'no-store',
    }).catch(() => {
    });
  } catch (err) {
  }

  try {
    const logoutImg = new Image();
    logoutImg.src = `${synologyApiLogoutUrl}&_ts=${Date.now()}`;
  } catch (err) {
  }

  window.location.replace('/');
};

// Dispatch auth error event when token is invalid/expired
export const notifyAuthError = (message = "Sessie verlopen. Controleer uw inloggegevens.") => {
  const event = new CustomEvent('familiez-auth-error', { detail: { message } });
  window.dispatchEvent(event);
};

export const setAuthHeader = (token) => ({
  Authorization: `Bearer ${token}`,
});

export const decodeToken = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const decoded = JSON.parse(atob(parts[1]));
    return decoded;
  } catch (err) {
    console.error('Failed to decode token:', err);
    return null;
  }
};

export const getUserInfo = () => {
  const token = getStoredToken();
  if (!token) {
    return null;
  }
  const decoded = decodeToken(token);
  if (!decoded) {
    return null;
  }
  
  // Extract username from preferred_username or sub, removing domain part if present
  let username = decoded.preferred_username || decoded.sub || '';
  if (username && username.includes('@')) {
    username = username.split('@')[0];
  }
  
  // Get role info from localStorage (set by fetchUserRole)
  const roleData = localStorage.getItem(STORAGE_USER_ROLE_KEY);
  let role = 'none';
  let is_admin = false;
  let is_user = false;
  
  if (roleData) {
    try {
      const parsed = JSON.parse(roleData);
      role = parsed.role || 'none';
      is_admin = parsed.is_admin || false;
      is_user = parsed.is_user || false;
    } catch (err) {
      console.warn('Failed to parse role data:', err);
    }
  }
  
  const userInfo = {
    username: username,
    given_name: decoded.given_name || '',
    family_name: decoded.family_name || '',
    name: decoded.name || '',
    email: decoded.email || '',
    role: role,
    is_admin: is_admin,
    is_user: is_user,
  };
  return userInfo;
};

/**
 * Fetch user role from /auth/me endpoint (LDAP group membership)
 * Call this after successful login to get role information
 */
export const fetchUserRole = async () => {
  const { apiBaseUrl } = getAuthConfig();
  const token = getStoredToken();
  
  if (!apiBaseUrl || !token) {
    console.warn('[authService] Cannot fetch user role: missing API base URL or token');
    return null;
  }
  
  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/auth/me`, {
      method: 'GET',
      headers: setAuthHeader(token),
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch user role: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    // Store role data in localStorage
    localStorage.setItem(STORAGE_USER_ROLE_KEY, JSON.stringify({
      username: data.username,
      role: data.role,
      is_admin: data.is_admin,
      is_user: data.is_user,
      groups: data.groups || [],
    }));
    
    notifyAuthChange();
    return data;
  } catch (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
};
