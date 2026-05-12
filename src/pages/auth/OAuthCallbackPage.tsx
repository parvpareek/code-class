import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAuthToken } from '@/lib/authTokenStorage';
import { writeLastSignInMethod } from '../../lib/lastSignInStorage';

/**
 * Full-page handler: API redirects here with #token=... or #error=...
 * after Google/GitHub OAuth. We persist the JWT and hard-navigate so AuthProvider reloads.
 */
const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const err = params.get('error');

    if (err) {
      setMessage(err);
      const t = setTimeout(() => navigate(`/login?error=${encodeURIComponent(err)}`), 2000);
      return () => clearTimeout(t);
    }

    if (!token) {
      setMessage('Missing token. Try signing in again.');
      const t = setTimeout(() => navigate('/login'), 2000);
      return () => clearTimeout(t);
    }

    const signInMethod = params.get('signInMethod');
    if (signInMethod === 'GOOGLE' || signInMethod === 'GITHUB') {
      writeLastSignInMethod(signInMethod);
    }

    setAuthToken(token);
    window.location.replace('/classes');
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue">
        <span className="text-xl font-bold text-white">CC</span>
      </div>
      <p className="max-w-md text-center text-muted-foreground">{message}</p>
    </div>
  );
};

export default OAuthCallbackPage;
