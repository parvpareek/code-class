import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { getApiV1BaseUrl } from '../../config/apiBase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Label } from '../../components/ui/label';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof formSchema>;

const LoginPage: React.FC = () => {
  const { login, error, isLoading, clearError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthRole, setOauthRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');

  const { googleHref, githubHref } = useMemo(() => {
    const base = getApiV1BaseUrl();
    const q = `role=${encodeURIComponent(oauthRole.toLowerCase())}`;
    return {
      googleHref: `${base}/auth/oauth/google/start?${q}`,
      githubHref: `${base}/auth/oauth/github/start?${q}`,
    };
  }, [oauthRole]);

  useEffect(() => {
    const e = searchParams.get('error');
    if (e) {
      setOauthError(e);
    }
  }, [searchParams]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.email, values.password);
      navigate('/classes');
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const displayError = oauthError || error;

  return (
    <>
      {displayError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2 mb-4">
        <Label>Signing in with Google / GitHub as</Label>
        <Select value={oauthRole} onValueChange={(v) => setOauthRole(v as 'STUDENT' | 'TEACHER')}>
          <SelectTrigger>
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STUDENT">Student (new accounts)</SelectItem>
            <SelectItem value="TEACHER">Teacher (new accounts)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          This only affects <strong>new</strong> accounts. Returning users keep their existing role.
        </p>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <Button variant="outline" className="w-full" asChild>
          <a href={googleHref}>Continue with Google</a>
        </Button>
        <Button variant="outline" className="w-full bg-[#24292f] text-white hover:bg-[#24292f]/90" asChild>
          <a href={githubHref}>Continue with GitHub</a>
        </Button>
      </div>

      <p className="text-center text-xs text-gray-500 mb-4">or log in with email if you already have a password</p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    {...field}
                    onChange={(e) => {
                      clearError();
                      setOauthError(null);
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    {...field}
                    onChange={(e) => {
                      clearError();
                      setOauthError(null);
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Log in'}
            </Button>
          </div>
        </form>
      </Form>

      <div className="mt-6 text-center text-sm">
        <p className="text-gray-500">
          Need an account?{' '}
          <Link to="/signup" className="text-brand-blue font-medium hover:underline">
            Sign up with Google or GitHub
          </Link>
        </p>
      </div>
    </>
  );
};

export default LoginPage;
