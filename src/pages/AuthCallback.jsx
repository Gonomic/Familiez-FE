import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { exchangeCodeForToken, fetchUserRole, startSessionKeepalive } from "../services/authService";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }
    hasProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    console.log("[AuthCallback] OAuth callback received:", { code: code ? "***" : "MISSING", state: state ? "***" : "MISSING" });

    if (!code || !state) {
      const msg = "Missing authorization data. Please try logging in again.";
      console.error("[AuthCallback]", msg, { code, state });
      setError(msg);
      return;
    }

    console.log("[AuthCallback] Starting token exchange...");
    exchangeCodeForToken(code, state)
      .then(async () => {
        console.log("[AuthCallback] Token exchange successful, fetching user role...");
        // Fetch user role from /auth/me endpoint after successful login
        await fetchUserRole();
        console.log("[AuthCallback] User role fetched, starting session keepalive...");
        // Start periodic session keepalive (NEW FEATURE for server-side sessions)
        startSessionKeepalive();
        console.log("[AuthCallback] Session keepalive started, navigating to /familiez-bewerken");
        navigate("/familiez-bewerken", { replace: true });
      })
      .catch((err) => {
        console.error("[AuthCallback] Authentication error:", err);
        setError(`Authentication failed: ${err.message}`);
      });
  }, [navigate]);

  if (error) {
    return <div>{error}</div>;
  }

  return <div>Signing you in...</div>;
};

export default AuthCallback;
