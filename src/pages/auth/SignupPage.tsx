import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { getApiV1BaseUrl } from '../../config/apiBase';

const SignupPage: React.FC = () => {
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');

  const { googleHref, githubHref } = useMemo(() => {
    const base = getApiV1BaseUrl();
    const q = `role=${encodeURIComponent(role.toLowerCase())}`;
    return {
      googleHref: `${base}/auth/oauth/google/start?${q}`,
      githubHref: `${base}/auth/oauth/github/start?${q}`,
    };
  }, [role]);

  return (
    <>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create an account</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose your role, then sign up with Google or GitHub. Existing accounts keep their current role when you
            sign in again.
          </p>
        </div>

        <div className="space-y-2">
          <Label>I am a</Label>
          <Select value={role} onValueChange={(v) => setRole(v as 'STUDENT' | 'TEACHER')}>
            <SelectTrigger>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STUDENT">Student</SelectItem>
              <SelectItem value="TEACHER">Teacher</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3">
          <Button variant="outline" className="w-full" asChild>
            <a href={googleHref}>Continue with Google</a>
          </Button>
          <Button variant="outline" className="w-full bg-[#24292f] text-white hover:bg-[#24292f]/90" asChild>
            <a href={githubHref}>Continue with GitHub</a>
          </Button>
        </div>
      </div>

      <div className="mt-6 text-center text-sm">
        <p className="text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-blue font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </>
  );
};

export default SignupPage;
