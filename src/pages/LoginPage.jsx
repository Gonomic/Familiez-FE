import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initiateSSOLogin } from '../services/authService';
import { getStackBuildNumber } from '../services/familyDataService';
import FamiliezSplash from '../assets/FamiliezSplash.png';
import '../styles/LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [stackBuildNumber, setStackBuildNumber] = useState(null);
  const [stackBuildReason, setStackBuildReason] = useState('middleware of database niet actief');

  useEffect(() => {
    let isMounted = true;
    getStackBuildNumber()
      .then((buildNumber) => {
        if (isMounted) {
          setStackBuildNumber(buildNumber);
          setStackBuildReason('middleware of database niet actief');
        }
      })
      .catch((error) => {
        if (isMounted) {
          setStackBuildNumber(null);
          setStackBuildReason(
            error.code === 'INVALID_STACK_BUILD_RESPONSE'
              ? 'ongeldige versie-informatie ontvangen'
              : 'middleware of database niet actief'
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async () => {
    try {
      await initiateSSOLogin();
    } catch (err) {
      console.error('Login failed:', err);
      alert('Login failed. Please check your SSO settings.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-logo-wrap">
          <img src={FamiliezSplash} alt="Familiez" className="login-logo" />
        </div>
        <p className="login-build">
          Build {stackBuildNumber ?? 'onbekend'}
          {stackBuildNumber === null && <span> ({stackBuildReason})</span>}
        </p>
        <p>Familie Beheer Systeem</p>
        
        <button 
          className="login-button"
          onClick={handleLogin}
        >
          Login
        </button>
        
        <p className="login-info">
          Je wordt omgeleid naar DekkNet voor autenticatie
        </p>
      </div>
    </div>
  );
}
