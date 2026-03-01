import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { exchangeCodeForToken, fetchUserRole } from "../services/authService";

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

    if (!code || !state) {
      setError("Missing authorization data. Please try logging in again.");
      return;
    }

    exchangeCodeForToken(code, state)
      .then(async () => {
        // Fetch user role from /auth/me endpoint after successful login
        await fetchUserRole();
        navigate("/familiez-bewerken", { replace: true });
      })
      .catch((err) => {
        console.error("Authentication error:", err);
        setError("Authentication failed. Please try again.");
      });
  }, [navigate]);

  if (error) {
    return <div>{error}</div>;
  }

  return <div>Signing you in...</div>;
};

export default AuthCallback;
