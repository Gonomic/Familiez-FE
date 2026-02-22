import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { exchangeCodeForToken } from "../services/authService";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      setError("Missing authorization data. Please try logging in again.");
      return;
    }

    exchangeCodeForToken(code, state)
      .then(() => navigate("/familiez-bewerken", { replace: true }))
      .catch((err) => {
        console.error(err);
        setError("Authentication failed. Please try again.");
      });
  }, [navigate]);

  if (error) {
    return <div>{error}</div>;
  }

  return <div>Signing you in...</div>;
};

export default AuthCallback;
