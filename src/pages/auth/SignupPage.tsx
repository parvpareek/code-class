import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { OAuthBrandButtons, RoleSegment } from '../../components/auth/OAuthBrandButtons';
import { getApiV1BaseUrl } from '../../config/apiBase';
import { readLastSignInMethod } from '@/lib/lastSignInStorage';

const SignupPage: React.FC = () => {
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const lastMethod = readLastSignInMethod();
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
