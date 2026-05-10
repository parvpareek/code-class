import React, { useEffect, useMemo, useState } from 'react';
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
import { AlertCircle, ChevronDown } from 'lucide-react';
import { getApiV1BaseUrl } from '../../config/apiBase';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../components/ui/collapsible';
import { OAuthBrandButtons, RoleSegment } from '../../components/auth/OAuthBrandButtons';
import { cn } from '@/lib/utils';

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
  const [emailOpen, setEmailOpen] = useState(false);

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
    } catch {
      // Error surfaced via AuthContext
    }
  };

  const displayError = oauthError || error;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Sign in</h2>
        <p className="text-sm text-muted-foreground">Use Google, GitHub, or your existing email</p>
      </div>

      {displayError && (
        <Alert variant="destructive" className="text-left">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      <RoleSegment
        value={oauthRole}
        onChange={setOauthRole}
        label="I am a (for new accounts)"
      />

      <OAuthBrandButtons googleHref={googleHref} githubHref={githubHref} />

      <Collapsible open={emailOpen} onOpenChange={setEmailOpen}>
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'mx-auto mt-1 flex w-full max-w-xs items-center justify-center gap-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
              'rounded-lg hover:bg-muted/60'
            )}
          >
            <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', emailOpen && 'rotate-180')} />
            Sign in with email &amp; password
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden">
          <div className="border-t border-border pt-5 mt-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          autoComplete="email"
                          className="h-11 rounded-lg"
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
                      <FormLabel className="text-foreground">Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="h-11 rounded-lg"
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

                <Button type="submit" className="h-11 w-full rounded-lg font-semibold" disabled={isLoading}>
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
            </Form>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <p className="text-center text-sm text-muted-foreground">
        No account?{' '}
        <Link to="/signup" className="font-semibold text-brand-blue hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
};

export default LoginPage;
