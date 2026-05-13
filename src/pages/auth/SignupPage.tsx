import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { OAuthBrandButtons, RoleSegment } from '../../components/auth/OAuthBrandButtons';
import { getApiV1BaseUrl } from '../../config/apiBase';
import {
  readLastSignInMethod,
  lastSignInMethodLabel,
  type ClientSignInMethod,
} from '@/lib/lastSignInStorage';

const SignupPage: React.FC = () => {
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [lastMethod, setLastMethod] = useState<ClientSignInMethod | null>(null);

  useEffect(() => {
    const sync = () => setLastMethod(readLastSignInMethod());
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const lastOAuth =
    lastMethod === 'GOOGLE' || lastMethod === 'GITHUB' ? lastMethod : undefined;

  const { googleHref, githubHref } = useMemo(() => {
    const base = getApiV1BaseUrl();
    const q = `role=${encodeURIComponent(role.toLowerCase())}`;
    return {
      googleHref: `${base}/auth/oauth/google/start?${q}`,
      githubHref: `${base}/auth/oauth/github/start?${q}`,
    };
  }, [role]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Create an account</h2>
        <p className="text-sm text-muted-foreground">Pick your role, then continue with Google or GitHub</p>
        {lastMethod ? (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm font-medium text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100">
            Last signed in with{' '}
            <span className="font-semibold">{lastSignInMethodLabel(lastMethod)}</span> on this browser.
          </p>
        ) : null}
      </div>

      <RoleSegment value={role} onChange={setRole} label="I am a" />

      <OAuthBrandButtons googleHref={googleHref} githubHref={githubHref} lastUsed={lastOAuth} />

      <p className="text-center text-xs text-muted-foreground">
        Already registered? Your role stays the same when you sign in again.
      </p>

      <p className="text-center text-sm text-muted-foreground">
        Have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-blue hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default SignupPage;
