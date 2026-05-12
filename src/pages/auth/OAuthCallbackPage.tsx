import React, { useEffect, useState } from 'react';
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

    localStorage.setItem('token', token);
    window.location.replace('/classes');
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="h-12 w-12 rounded-full bg-brand-blue flex items-center justify-center mb-6">
        <span className="text-white text-xl font-bold">CC</span>
      </div>
      <p className="text-center text-muted-foreground max-w-md">{message}</p>
    </div>
  );
};

export default OAuthCallbackPage;
