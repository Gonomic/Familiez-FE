import React from 'react';
import { useNavigate } from 'react-router-dom';
import { initiateSSOLogin } from '../services/authService';
import FamiliezSplash from '../assets/FamiliezSplash.png';
import '../styles/LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();

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
        <img src={FamiliezSplash} alt="Familiez" className="login-logo" />
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
