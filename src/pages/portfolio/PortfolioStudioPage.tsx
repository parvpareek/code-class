import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGithubPreview,
  getMyPortfolio,
  getGithubReadme,
  parseResumePdf,
  fillPortfolioWithAi,
  suggestPortfolioField,
  updateMyPortfolio,
} from '@/api/portfolio';
import { PortfolioView, type PortfolioEditTarget, type PortfolioSectionStructureHandlers } from '@/components/portfolio/PortfolioView';
import {
  AppearanceDock,
  StudioCommandPalette,
  StudioPublishPill,
} from '@/components/portfolio/studio/StudioRails';
import { OnboardingThemeStep } from '@/components/portfolio/studio/OnboardingThemeStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  applyResumeDraft,
  freshOnboardingPortfolioContent,
  githubPreviewToClientDraft,
  mergeBulkAiPortfolioFill,
  mergePortfolioDraft,
  normalizePortfolioContent,
  shouldSkipPortfolioWizard,
  type GithubPreviewDto,
} from '@/lib/portfolioMerge';
import { buildPortfolioSuggestContext } from '@/lib/portfolioSuggestContext';
import {
  formatEducationDateRange,
  formatExperienceDateRange,
  toMonthInputValue,
} from '@/lib/portfolioDates';
import {
  clearStudioGeminiKey,
  getStudioGeminiKey,
  setStudioGeminiKey,
} from '@/lib/studioGeminiKey';
import type {
  PortfolioContent,
  PortfolioProject,
  PortfolioTheme,
  PortfolioSectionId,
  PortfolioStoryImageAfter,
} from '@/types/portfolio';
import { Sparkles, ArrowRight, LogOut, LayoutList, Loader2 } from 'lucide-react';
import { moveInOrder } from '@/lib/portfolioSectionOrder';
import { sectionOrderForSignal } from '@/lib/portfolioSignalPresets';
import { cn } from '@/lib/utils';
import { githubLoginFromProfileUrl, githubProfilePngUrl, resolvePortfolioHeroAvatarUrl } from '@/lib/githubAvatar';
import { invalidateAllClassmateRosterQueries } from '@/lib/classmatesQuery';

const README_FETCH_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        window.clearTimeout(id);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(id);
        reject(e);
      }
    );
  });
}

function metricsTextFromRecord(metrics: Record<string, string> | undefined): string {
  if (!metrics || typeof metrics !== 'object') return '';
  return Object.entries(metrics)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function portfolioRepoInsightsEqual(
  a: PortfolioProject['repoInsight'],
  b: PortfolioProject['repoInsight']
): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.repoFullName === b.repoFullName &&
    a.fetchedAt === b.fetchedAt &&
    a.error === b.error &&
    a.stars === b.stars &&
    a.forks === b.forks &&
    a.contributors === b.contributors &&
    a.codeBytes === b.codeBytes &&
    a.linesEstimate === b.linesEstimate &&
    a.repoCreatedAt === b.repoCreatedAt &&
    a.lastPushAt === b.lastPushAt
  );
}

function metricsRecordFromText(text: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && v) o[k] = v;
  }
  return o;
}

function repoInsightStudioCaption(p: PortfolioProject): string {
  const ri = p.repoInsight;
  if (!p.githubUrl?.trim()) {
    return 'Add a public GitHub repo URL. LOC, stars, and dates fill in when you save (refreshed about every 6 hours per repo).';
  }
  if (!ri) return 'GitHub stats appear after the next successful save.';
  if (ri.error) return `GitHub: ${ri.error}`;
  const parts: string[] = [];
  if (typeof ri.linesEstimate === 'number' && ri.linesEstimate > 0) {
    const n = ri.linesEstimate;
    const loc = n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
    parts.push(`LOC: ${loc}`);
  }
  if (typeof ri.stars === 'number' && ri.stars > 0) {
    parts.push(`${ri.stars}★`);
  }
  if (ri.repoCreatedAt && ri.lastPushAt) {
    try {
      const a = new Date(ri.repoCreatedAt);
      const b = new Date(ri.lastPushAt);
      const opts: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' };
      const A = a.toLocaleDateString(undefined, opts);
      const B = b.toLocaleDateString(undefined, opts);
      parts.push(A === B ? A : `${A}–${B}`);
    } catch {
      /* ignore */
    }
  }
  return parts.length ? parts.join(' · ') : 'Linked; waiting for GitHub data.';
}

/** Comma-separated tags: split on commas, trim each tag (used on blur / sheet close). */
function commaSeparatedToArray(raw: string, maxParts: number): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, maxParts);
}

/** For autosave while typing: trim completed segments only; keep last segment raw so spaces/incomplete tags stay intact. */
function commaTagsFromTyping(raw: string, maxParts: number): string[] {
  const parts = raw.split(',').slice(0, maxParts);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (i < parts.length - 1) {
      const t = seg.trim();
      if (t) out.push(t);
    } else {
      out.push(seg);
    }
  }
  return out;
}

function joinCommaList(items: string[]): string {
  return items.join(',');
}

/** One bullet per line: trim completed lines only; keep the last line raw. */
function parseBulletLinesPreserveTrail(raw: string, maxLines: number): string[] {
  const lines = raw.split('\n').slice(0, maxLines);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i < lines.length - 1) {
      const t = line.trim();
      if (t) out.push(t);
    } else {
      out.push(line);
    }
  }
  return out;
}

const GEN_STEPS = [
  'Analyzing repositories…',
  'Extracting technologies…',
  'Identifying strongest projects…',
  'Building developer profile…',
  'Generating portfolio structure…',
];

const GEN_STEP_AI = 'Writing portfolio copy with AI…';

type WizardPhase =
  | 'welcome'
  | 'github'
  | 'curate'
  | 'theme'
  | 'resume'
  | 'ai'
  | 'generating'
  | 'reveal'
  | 'edit';

function WizardShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background via-background to-muted/30 px-6 py-16',
        className
      )}
    >
      <div className="w-full max-w-md space-y-8 text-center motion-reduce:transition-none">{children}</div>
    </div>
  );
}

const PortfolioStudioPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({ queryKey: ['portfolio', 'me'], queryFn: getMyPortfolio });
  const [phase, setPhase] = useState<WizardPhase>('welcome');
  const [phaseBootstrapped, setPhaseBootstrapped] = useState(false);

  const [draftContent, setDraftContent] = useState<PortfolioContent | null>(null);
  const [theme, setTheme] = useState<PortfolioTheme>('VOID');
  const [slug, setSlug] = useState('');
  const [published, setPublished] = useState(false);
  /** Bumps Pit wall cinematic replay in PortfolioView without full page reload (reset when theme changes). */
  const [signatureIntroReplayNonce, setSignatureIntroReplayNonce] = useState(0);

  const [githubInput, setGithubInput] = useState('');
  const [ghPreview, setGhPreview] = useState<GithubPreviewDto | null>(null);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);
  const [pendingGithubDraft, setPendingGithubDraft] = useState<Partial<PortfolioContent> | null>(null);
  const [curateSelection, setCurateSelection] = useState<string[]>([]);

  const [resumePdfBusy, setResumePdfBusy] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<Partial<PortfolioContent> | null>(null);
  const [resumePick, setResumePick] = useState({
    hero: true,
    skills: true,
    experience: true,
    education: true,
  });
  /** Plain resume text from PDF (for Gemini bulk fill). */
  const [resumePlainText, setResumePlainText] = useState('');
  const [aiKeyInput, setAiKeyInput] = useState('');
  const [geminiHelpOpen, setGeminiHelpOpen] = useState(false);
  const [genIndex, setGenIndex] = useState(0);

  const [editFocusKey, setEditFocusKey] = useState<string | null>(null);
  const [sheet, setSheet] = useState<PortfolioEditTarget | null>(null);
  /** Raw comma-separated text per skills row; split on blur only. */
  const [skillsItemsDraft, setSkillsItemsDraft] = useState<Record<number, string>>({});
  /** Raw interests line; split on blur / sheet close. */
  const [howIBuildInterestsText, setHowIBuildInterestsText] = useState('');
  /** Raw tech / signal lines per project index while project sheet is open. */
  const [projectTechText, setProjectTechText] = useState<Record<number, string>>({});
  const [projectSignalText, setProjectSignalText] = useState<Record<number, string>>({});
  /** Raw extra metrics (Label: value lines) while project sheet is open. */
  const [projectMetricsText, setProjectMetricsText] = useState<Record<number, string>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [commandOpen, setCommandOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState<string | null>(null);
  const [resetOnboardingOpen, setResetOnboardingOpen] = useState(false);
  const [resetOnboardingBusy, setResetOnboardingBusy] = useState(false);

  useEffect(() => {
    setSignatureIntroReplayNonce(0);
  }, [theme]);

  /** Bumps on each autosave schedule so stale in-flight PUT responses cannot revert theme/publish/slug. */
  const saveEpochRef = React.useRef(0);
  const genProgressLabelsRef = React.useRef<string[]>([...GEN_STEPS]);
  const genProgressTotalRef = React.useRef(GEN_STEPS.length);

  const moveSection = useCallback((id: PortfolioSectionId, dir: -1 | 1) => {
    setDraftContent((c) => {
      if (!c) return c;
      return {
        ...c,
        sections: {
          ...c.sections,
          order: moveInOrder(c.sections.order, id, dir),
        },
      };
    });
  }, []);

  const toggleSectionHidden = useCallback((id: PortfolioSectionId) => {
    if (id === 'hero') return;
    setDraftContent((c) => {
      if (!c) return c;
      const h = new Set(c.sections.hidden);
      if (h.has(id)) h.delete(id);
      else h.add(id);
      return {
        ...c,
        sections: {
          ...c.sections,
          hidden: Array.from(h) as PortfolioSectionId[],
        },
      };
    });
  }, []);

  const sectionStructure: PortfolioSectionStructureHandlers = React.useMemo(
    () => ({
      moveSection,
      toggleSectionHidden,
    }),
    [moveSection, toggleSectionHidden]
  );

  const prevSheetForSkillsInit = React.useRef<PortfolioEditTarget | null>(null);
  useEffect(() => {
    if (sheet === 'skills' && draftContent) {
      if (prevSheetForSkillsInit.current !== 'skills') {
        const d: Record<number, string> = {};
        draftContent.skills.forEach((cat, i) => {
          d[i] = joinCommaList(cat.items);
        });
        setSkillsItemsDraft(d);
      }
      prevSheetForSkillsInit.current = sheet;
    } else {
      prevSheetForSkillsInit.current = sheet;
    }
  }, [sheet, draftContent]);

  const prevSheetForHowIBuildInit = React.useRef<PortfolioEditTarget | null>(null);
  useEffect(() => {
    if (sheet === 'howIBuild' && draftContent) {
      if (prevSheetForHowIBuildInit.current !== 'howIBuild') {
        setHowIBuildInterestsText(joinCommaList(draftContent.howIBuild?.interests ?? []));
      }
      prevSheetForHowIBuildInit.current = sheet;
    } else {
      prevSheetForHowIBuildInit.current = sheet;
    }
  }, [sheet, draftContent]);

  const prevProjectSheetForDraft = React.useRef<string | null>(null);
  useEffect(() => {
    const key = typeof sheet === 'string' && sheet.startsWith('project-') ? sheet : null;
    if (key && draftContent) {
      const idx = Number.parseInt(key.slice('project-'.length), 10);
      const p = draftContent.projects[idx];
      if (p && prevProjectSheetForDraft.current !== key) {
        setProjectTechText((d) => ({ ...d, [idx]: joinCommaList(p.techStack ?? []) }));
        setProjectSignalText((d) => ({ ...d, [idx]: joinCommaList(p.signalCues ?? []) }));
        setProjectMetricsText((d) => ({ ...d, [idx]: metricsTextFromRecord(p.metrics) }));
      }
      prevProjectSheetForDraft.current = key;
    } else {
      prevProjectSheetForDraft.current = null;
    }
  }, [sheet, draftContent]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof updateMyPortfolio>[0]) => updateMyPortfolio(body),
  });

  const qcRef = React.useRef(qc);
  qcRef.current = qc;
  const toastRef = React.useRef(toast);
  toastRef.current = toast;
  const portfolioMutateRef = React.useRef(updateMutation.mutate);
  portfolioMutateRef.current = updateMutation.mutate;

  const clearWizardFormState = useCallback(() => {
    setGithubInput('');
    setGhPreview(null);
    setGhError(null);
    setGhLoading(false);
    setPendingGithubDraft(null);
    setCurateSelection([]);
    setResumeDraft(null);
    setResumePlainText('');
    setResumePick({ hero: true, skills: true, experience: true, education: true });
    setAiKeyInput('');
    setGenIndex(0);
    setResumePdfBusy(false);
  }, []);

  const performResetOnboarding = useCallback(async () => {
    if (!data) return;
    setResetOnboardingBusy(true);
    try {
      const fresh = normalizePortfolioContent(freshOnboardingPortfolioContent());
      const saved = await updateMutation.mutateAsync({
        content: fresh,
        slug: data.slug,
        published: false,
        theme: data.theme,
      });
      qc.setQueryData(['portfolio', 'me'], saved);
      invalidateAllClassmateRosterQueries(qc);
      setDraftContent(normalizePortfolioContent(structuredClone(saved.content)));
      setSlug(saved.slug);
      setPublished(false);
      setTheme(saved.theme);
      clearWizardFormState();
      setPhase('welcome');
      setResetOnboardingOpen(false);
      toast({
        title: 'Portfolio reset',
        description: 'Your slug is unchanged. Tap Begin to import GitHub and run the wizard again.',
      });
    } catch {
      toast({ title: 'Reset failed', variant: 'destructive' });
    } finally {
      setResetOnboardingBusy(false);
    }
  }, [data, updateMutation, clearWizardFormState, toast, qc]);

  /** Avoid one paint stuck on LoadingScreen while draft hydrates from the first portfolio response. */
  React.useLayoutEffect(() => {
    if (!data) return;
    setDraftContent((prev) =>
      prev === null ? normalizePortfolioContent(structuredClone(data.content)) : prev
    );
  }, [data]);

  useEffect(() => {
    if (!data) return;
    if (phase !== 'edit') {
      setDraftContent(normalizePortfolioContent(structuredClone(data.content)));
      setTheme(data.theme);
      setSlug(data.slug);
      setPublished(data.published);
    }
  }, [data, phase]);

  useEffect(() => {
    if (!data || phaseBootstrapped) return;
    setPhase(shouldSkipPortfolioWizard(data.content) ? 'reveal' : 'welcome');
    setPhaseBootstrapped(true);
  }, [data, phaseBootstrapped]);

  useEffect(() => {
    if (phase !== 'edit' || !draftContent) return;
    setSaveState('saving');
    const seq = ++saveEpochRef.current;
    const payload = { content: draftContent, slug, published, theme };
    const t = setTimeout(() => {
      portfolioMutateRef.current(payload, {
        onSuccess: (d) => {
          if (saveEpochRef.current !== seq) return;
          qcRef.current.setQueryData(['portfolio', 'me'], {
            ...d,
            theme: payload.theme,
            slug: payload.slug,
            published: payload.published,
          });
          setDraftContent((prev) => {
            if (!prev) return normalizePortfolioContent(structuredClone(d.content));
            let anyProjectChanged = false;
            const nextProjects = prev.projects.map((proj) => {
              const match = d.content.projects.find(
                (s) => s.githubUrl === proj.githubUrl && s.title === proj.title
              );
              if (!match) return proj;
              if (portfolioRepoInsightsEqual(proj.repoInsight, match.repoInsight)) return proj;
              anyProjectChanged = true;
              return { ...proj, repoInsight: match.repoInsight };
            });
            if (!anyProjectChanged) return prev;
            return { ...prev, projects: nextProjects };
          });
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 1500);
          invalidateAllClassmateRosterQueries(qcRef.current);
        },
        onError: () => {
          if (saveEpochRef.current !== seq) return;
          setSaveState('idle');
          toastRef.current({ title: 'Could not save', variant: 'destructive' });
        },
      });
    }, 1400);
    return () => clearTimeout(t);
  }, [draftContent, slug, published, theme, phase]);

  const displayName = data?.displayName ?? 'Developer';
  const platformSolved = data?.platformSolved ?? {};
  const activityPayload = data?.activity ?? { githubByDate: {}, dsaByDate: {} };

  const runGithubLookup = async () => {
    setGhLoading(true);
    setGhError(null);
    try {
      const p = await getGithubPreview(githubInput.trim());
      setGhPreview(p);
      setPendingGithubDraft(null);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as { response?: { data?: { message?: string } } }).response?.data?.message : null;
      setGhError(msg ?? 'Could not load GitHub profile');
      setGhPreview(null);
      setPendingGithubDraft(null);
    } finally {
      setGhLoading(false);
    }
  };

  const runGeneration = useCallback(async (opts?: { skipAi?: boolean }) => {
    if (!data) return;
    const storedKey = opts?.skipAi ? null : getStudioGeminiKey();
    const trimmedInput = opts?.skipAi ? '' : aiKeyInput.trim();
    const userGeminiKey =
      storedKey && storedKey.length >= 20 ? storedKey : trimmedInput.length >= 20 ? trimmedInput : '';
    const useAiBulk = userGeminiKey.length >= 20;

    if (useAiBulk) {
      const stepLabels = [...GEN_STEPS, GEN_STEP_AI];
      genProgressLabelsRef.current = stepLabels;
      genProgressTotalRef.current = stepLabels.length;
    } else {
      genProgressLabelsRef.current = ['Saving your portfolio…'];
      genProgressTotalRef.current = 1;
    }

    setPhase('generating');
    setGenIndex(0);
    await new Promise<void>((r) => {
      requestAnimationFrame(() => requestAnimationFrame(() => r()));
    });
    try {
      if (useAiBulk) {
        const prefersReduced =
          typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const stepDelay = prefersReduced ? 120 : 550;
        for (let i = 0; i < GEN_STEPS.length; i++) {
          setGenIndex(i);
          await new Promise((r) => setTimeout(r, stepDelay));
        }
      }

      let next = normalizePortfolioContent(structuredClone(data.content));
      if (pendingGithubDraft) {
        next = mergePortfolioDraft(next, pendingGithubDraft);
      }
      if (resumeDraft) {
        next = applyResumeDraft(next, resumeDraft, resumePick);
      }
      next.featuredSignal = 'PROJECTS';
      next.sections = {
        hidden: next.sections.hidden,
        order: sectionOrderForSignal('PROJECTS'),
      };

      if (useAiBulk && next.projects?.length) {
        const projects = [...next.projects];
        for (let i = 0; i < projects.length; i++) {
          const proj = projects[i];
          const m = proj.githubUrl?.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
          if (!m) continue;
          await new Promise<void>((r) => setTimeout(r, 120));
          try {
            const raw = await withTimeout(getGithubReadme(m[1], m[2]), README_FETCH_MS);
            const trimmed = raw.trim();
            let updated = { ...proj };
            if (!(proj.longDescription ?? '').trim() && trimmed.length > 40) {
              updated.longDescription = trimmed.slice(0, 2500);
            }
            if ((proj.shortDescription?.length ?? 0) < 36) {
              const line = trimmed
                .split('\n')
                .map((l) => l.replace(/^#+\s*/, '').trim())
                .find((l) => l.length > 12 && l.length < 240);
              if (line) {
                updated.shortDescription = line.slice(0, 280);
              }
            }
            projects[i] = updated;
          } catch {
            /* optional README enrichment */
          }
        }
        next = { ...next, projects };
      }

      if (useAiBulk) {
        setGenIndex(GEN_STEPS.length);
        const resumeExcerpt = resumePlainText.trim();
        const fill = await fillPortfolioWithAi({
          geminiApiKey: userGeminiKey,
          resumeText: resumeExcerpt || undefined,
          portfolioContext: buildPortfolioSuggestContext(next, resumeExcerpt || undefined),
          projectSkeletons: (next.projects ?? []).slice(0, 8).map((p) => ({
            title: p.title,
            githubUrl: p.githubUrl,
            techStack: p.techStack,
          })),
        });
        next = mergeBulkAiPortfolioFill(next, fill);
      }

      next.studio = { ...next.studio, onboardingComplete: true, wizardVersion: 1 };

      const saved = await updateMyPortfolio({
        content: next,
        slug: data.slug,
        published: data.published,
        theme,
      });
      qc.setQueryData(['portfolio', 'me'], saved);
      invalidateAllClassmateRosterQueries(qc);
      setPhase('reveal');
      toast({ title: 'Your engineering identity is ready' });
    } catch (e: unknown) {
      console.error('Portfolio generation failed', e);
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : e instanceof Error
            ? e.message
            : null;
      toast({
        title: 'Could not finish setup',
        description: msg ?? 'Check your connection and try again.',
        variant: 'destructive',
      });
      setPhase('ai');
    }
  }, [
    data,
    pendingGithubDraft,
    resumeDraft,
    resumePick,
    resumePlainText,
    aiKeyInput,
    qc,
    toast,
    theme,
  ]);

  const openSheet = (target: PortfolioEditTarget) => {
    setEditFocusKey(target);
    setSheet(target);
  };

  const closeSheet = () => {
    setDraftContent((c) => {
      if (!c) return c;
      let next = c;

      if (sheet === 'howIBuild') {
        const items = commaSeparatedToArray(howIBuildInterestsText, 8);
        const bullets = c.howIBuild?.bullets ?? [];
        const hasAnything =
          items.some((x) => x.trim().length > 0) || bullets.some((b) => b.trim().length > 0);
        next = { ...next, howIBuild: hasAnything ? { bullets, interests: items } : null };
      }

      if (sheet === 'skills') {
        const skills = c.skills.map((cat, ci) => {
          const raw = skillsItemsDraft[ci] ?? joinCommaList(cat.items);
          const items = commaSeparatedToArray(raw, 30);
          return { ...cat, items };
        });
        next = { ...next, skills };
      }

      if (typeof sheet === 'string' && sheet.startsWith('project-')) {
        const i = Number.parseInt(sheet.slice('project-'.length), 10);
        const p = c.projects[i];
        if (p) {
          const rawSig = projectSignalText[i] ?? joinCommaList(p.signalCues ?? []);
          const rawTech = projectTechText[i] ?? joinCommaList(p.techStack ?? []);
          const rawMetrics = projectMetricsText[i] ?? metricsTextFromRecord(p.metrics);
          const signalCues = commaSeparatedToArray(rawSig, 10);
          const techStack = commaSeparatedToArray(rawTech, 20);
          const metrics = metricsRecordFromText(rawMetrics);
          const projects = [...c.projects];
          projects[i] = {
            ...p,
            signalCues: signalCues.length ? signalCues : undefined,
            techStack: techStack.length ? techStack : [],
            metrics: Object.keys(metrics).length ? metrics : undefined,
          };
          next = { ...next, projects };
        }
      }

      return next;
    });
    setSheet(null);
    setEditFocusKey(null);
  };

  const onRequestEdit = (target: PortfolioEditTarget) => {
    openSheet(target);
  };

  if (authLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: '/portfolio/studio' }} />;
  }
  if (isLoading || !data || !draftContent) {
    return error ? (
      <div className="flex min-h-screen items-center justify-center p-6 text-destructive">Failed to load</div>
    ) : (
      <LoadingScreen />
    );
  }

  const portfolioResetDialog = (
    <AlertDialog open={resetOnboardingOpen} onOpenChange={setResetOnboardingOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset portfolio and start onboarding over?</AlertDialogTitle>
          <AlertDialogDescription>
            This clears all portfolio content (projects, bio, skills, stories, activity notes) and marks setup as not
            finished. Your public URL slug stays the same, but your portfolio will be{' '}
            <span className="font-medium text-foreground">unpublished</span> until you publish again after rebuilding.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={resetOnboardingBusy}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={resetOnboardingBusy}
            onClick={() => void performResetOnboarding()}
          >
            {resetOnboardingBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reset and clear
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const header = (
    <header className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-2 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-tight">Portfolio Studio</span>
        {(phase === 'edit' || phase === 'reveal') && (
          <span className="text-xs text-muted-foreground">
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {phase === 'reveal' ? (
          <Button size="sm" onClick={() => setPhase('edit')}>
            Customize
          </Button>
        ) : null}
        {published && phase !== 'welcome' ? (
          <Button variant="outline" size="sm" asChild>
            <a href={`/p/${slug}`} target="_blank" rel="noreferrer">
              Public
            </a>
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" asChild>
          <Link to="/classes" className="gap-1">
            <LogOut className="h-3.5 w-3.5" />
            Exit
          </Link>
        </Button>
      </div>
    </header>
  );

  if (phase === 'welcome') {
    return (
      <>
        {header}
        <WizardShell>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Code Class</p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Let&apos;s build your engineering identity.</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A focused portfolio from your work, projects, and coding journey — structured for recruiters.
          </p>
          <Button size="lg" className="mx-auto w-full max-w-xs" onClick={() => setPhase('github')}>
            Begin
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </WizardShell>
      </>
    );
  }

  if (phase === 'github') {
    return (
      <>
        {header}
        <WizardShell>
          <h2 className="text-2xl font-bold">GitHub</h2>
          <p className="text-sm text-muted-foreground">Paste your GitHub username — we&apos;ll pull your public profile and repos.</p>
          <div className="flex gap-2">
            <Input
              placeholder="octocat"
              value={githubInput}
              onChange={(e) => setGithubInput(e.target.value)}
              className="text-center"
              onKeyDown={(e) => e.key === 'Enter' && githubInput.trim() && runGithubLookup()}
            />
            <Button type="button" disabled={!githubInput.trim() || ghLoading} onClick={runGithubLookup}>
              {ghLoading ? '…' : 'Load'}
            </Button>
          </div>
          {ghError ? <p className="text-sm text-destructive">{ghError}</p> : null}
          {ghPreview ? (
            <div className="rounded-xl border bg-card p-4 text-left shadow-sm">
              <div className="flex items-center gap-3">
                {ghPreview.avatarUrl ? (
                  <img src={ghPreview.avatarUrl} alt="" className="h-14 w-14 rounded-full" />
                ) : null}
                <div>
                  <p className="font-semibold">{ghPreview.name ?? ghPreview.login}</p>
                  <p className="text-xs text-muted-foreground">
                    @{ghPreview.login} · {ghPreview.publicRepos} public repos
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => setPhase('welcome')}>
              Back
            </Button>
            <Button
              disabled={!ghPreview?.topRepos?.length}
              onClick={() => {
                const repos = ghPreview!.topRepos;
                const initial = repos.slice(0, Math.min(5, repos.length)).map((r) => r.name);
                setCurateSelection(initial);
                setPhase('curate');
              }}
            >
              Continue
            </Button>
          </div>
        </WizardShell>
      </>
    );
  }

  if (phase === 'curate') {
    if (!ghPreview?.topRepos?.length) {
      return (
        <>
          {header}
          <WizardShell>
            <p className="text-sm text-muted-foreground">Load GitHub repositories first.</p>
            <Button type="button" onClick={() => setPhase('github')}>
              Back to GitHub
            </Button>
          </WizardShell>
        </>
      );
    }
    const minPick = Math.min(3, ghPreview.topRepos.length);
    return (
      <>
        {header}
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background via-background to-muted/30 px-4 py-16">
          <div className="w-full max-w-2xl space-y-6 text-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Curate</p>
              <h2 className="text-2xl font-bold tracking-tight">Which work represents you best?</h2>
              <p className="text-sm text-muted-foreground">
                Pick {minPick}–5 public repositories to feature.
              </p>
            </div>
            <div className="max-h-[min(28rem,56vh)] space-y-2 overflow-y-auto text-left">
              {ghPreview.topRepos.map((r) => {
                const selected = curateSelection.includes(r.name);
                return (
                  <div
                    key={r.name}
                    className={cn(
                      'rounded-xl border p-3 transition-colors',
                      selected ? 'border-primary bg-primary/5' : 'border-border'
                    )}
                  >
                    <button
                      type="button"
                      className="flex w-full flex-col gap-1 text-left"
                      onClick={() => {
                        setCurateSelection((prev) => {
                          if (prev.includes(r.name)) return prev.filter((x) => x !== r.name);
                          if (prev.length >= 5) return prev;
                          return [...prev, r.name];
                        });
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{r.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">★ {r.stars}</span>
                      </div>
                      {r.description ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {r.language ? <span>{r.language}</span> : null}
                        <span>Updated {new Date(r.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" type="button" onClick={() => setPhase('github')}>
                Back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const selectedRepos = ghPreview.topRepos.filter((repo) =>
                    curateSelection.includes(repo.name)
                  );
                  if (selectedRepos.length < minPick) {
                    toast({
                      title: `Choose at least ${minPick} project${minPick === 1 ? '' : 's'}`,
                      variant: 'destructive',
                    });
                    return;
                  }
                  setPendingGithubDraft(githubPreviewToClientDraft(ghPreview, displayName, selectedRepos));
                  setPhase('theme');
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (phase === 'theme' && data) {
    return (
      <OnboardingThemeStep
        data={data}
        pendingGithubDraft={pendingGithubDraft}
        theme={theme}
        onTheme={setTheme}
        displayName={displayName}
        platformSolved={platformSolved}
        activity={activityPayload}
        header={header}
        onBack={() => setPhase('curate')}
        onContinue={() => setPhase('resume')}
      />
    );
  }

  if (phase === 'resume') {
    return (
      <>
        {header}
        <WizardShell>
          <h2 className="text-2xl font-bold">Pre-fill experience?</h2>
          <p className="text-sm text-muted-foreground">
            Want us to pre-fill experience and education from a resume? Optional — you can always edit later.
          </p>
          <Input
            type="file"
            accept="application/pdf"
            disabled={resumePdfBusy}
            className="cursor-pointer text-xs"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setResumePdfBusy(true);
              try {
                const { draft, resumeText: rt } = await parseResumePdf(f);
                setResumeDraft(draft);
                setResumePlainText(typeof rt === 'string' ? rt : '');
                toast({ title: 'Resume parsed' });
              } catch {
                toast({ title: 'Could not parse PDF', variant: 'destructive' });
              } finally {
                setResumePdfBusy(false);
              }
            }}
          />
          {resumePdfBusy ? <p className="text-xs text-muted-foreground">Reading PDF…</p> : null}
          {resumeDraft ? (
            <div className="space-y-2 rounded-lg border p-3 text-left text-xs">
              {(['hero', 'skills', 'experience', 'education'] as const).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <Checkbox
                    id={`rp-${k}`}
                    checked={resumePick[k]}
                    onCheckedChange={(c) => setResumePick((p) => ({ ...p, [k]: c === true }))}
                  />
                  <Label htmlFor={`rp-${k}`} className="capitalize">
                    Merge {k}
                  </Label>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => setPhase('theme')}>
              Back
            </Button>
            <Button onClick={() => setPhase('ai')}>Continue</Button>
          </div>
        </WizardShell>
      </>
    );
  }

  if (phase === 'ai') {
    return (
      <>
        {header}
        <WizardShell>
          <h2 className="text-2xl font-bold">Bring your own AI</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Your key stays in this browser. We send it only with each suggestion request — never stored on our servers.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => setGeminiHelpOpen(true)}
          >
            How to get a free Gemini API key (Google AI Studio)
          </Button>
          <Dialog open={geminiHelpOpen} onOpenChange={setGeminiHelpOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Get a free Gemini API key</DialogTitle>
                <DialogDescription>
                  Google AI Studio offers API keys on a free tier for experimentation. Create a key there, then paste it
                  below. Your key is only sent from this browser when you ask for suggestions or run portfolio fill.
                </DialogDescription>
              </DialogHeader>
              <ol className="list-decimal space-y-3 pl-4 text-left text-sm text-muted-foreground">
                <li>
                  Open{' '}
                  <a
                    href="https://aistudio.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    Google AI Studio
                  </a>{' '}
                  and sign in with your Google account.
                </li>
                <li>
                  Open the{' '}
                  <strong className="text-foreground">Get API key</strong> page (menu on the left, or use this direct
                  link:{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    aistudio.google.com/app/apikey
                  </a>
                  ).
                </li>
                <li>
                  Click <strong className="text-foreground">Create API key</strong>. You can attach it to an existing
                  Google Cloud project or let AI Studio create one for you.
                </li>
                <li>
                  Copy the key, paste it into the field on this screen, then choose <strong className="text-foreground">Use AI enhancements &amp; build</strong> to save it in this browser and continue.
                </li>
              </ol>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setGeminiHelpOpen(false)}>
                  Close
                </Button>
                <Button type="button" asChild>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                    Open API keys in AI Studio
                  </a>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Textarea
            placeholder="Google AI Studio API key (optional)"
            value={aiKeyInput}
            onChange={(e) => setAiKeyInput(e.target.value)}
            className="min-h-[80px] font-mono text-xs"
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                if (aiKeyInput.trim().length >= 20) setStudioGeminiKey(aiKeyInput.trim());
                void runGeneration();
              }}
            >
              Use AI enhancements &amp; build
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                clearStudioGeminiKey();
                void runGeneration({ skipAi: true });
              }}
            >
              Skip for now
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPhase('resume')}>
            Back
          </Button>
        </WizardShell>
      </>
    );
  }

  if (phase === 'generating') {
    return (
      <>
        {header}
        <WizardShell>
          <div className="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all motion-reduce:transition-none"
              style={{
                width: `${((genIndex + 1) / Math.max(1, genProgressTotalRef.current)) * 100}%`,
              }}
            />
          </div>
          <p className="animate-pulse text-sm font-medium motion-reduce:animate-none">
            {genProgressLabelsRef.current[genIndex] ?? '…'}
          </p>
        </WizardShell>
      </>
    );
  }

  return (
    <>
      {header}
      <div className={cn('min-h-screen', phase === 'edit' ? 'pt-12' : 'pt-12')}>
        <PortfolioView
          displayName={displayName}
          content={draftContent}
          platformSolved={platformSolved}
          activity={activityPayload}
          theme={theme}
          mode={phase === 'edit' ? 'edit' : 'readonly'}
          editFocusKey={editFocusKey}
          displayDensity={draftContent.displayDensity}
          onRequestEdit={phase === 'edit' ? onRequestEdit : undefined}
          sectionStructure={phase === 'edit' ? sectionStructure : undefined}
          revealStagger={phase === 'reveal'}
          portfolioSlug={slug.trim() || undefined}
          signatureIntroReplayNonce={signatureIntroReplayNonce}
        />
        {phase === 'reveal' ? (
          <Button
            size="lg"
            className="fixed bottom-8 left-1/2 z-40 -translate-x-1/2 shadow-xl"
            onClick={() => setPhase('edit')}
          >
            Customize
          </Button>
        ) : null}
        {phase === 'edit' ? (
          <>
            <StudioPublishPill slug={slug} onSlug={setSlug} published={published} onPublished={setPublished} />
            <div className="fixed bottom-6 left-6 z-40 flex items-end gap-2">
              <AppearanceDock
                hidden={false}
                theme={theme}
                onTheme={setTheme}
                content={draftContent}
                onContentChange={setDraftContent}
                portfolioSlug={slug}
                onReplaySignatureIntro={() =>
                  setSignatureIntroReplayNonce((n) => (Number.isFinite(n) ? n + 1 : 1))
                }
                onRequestPortfolioReset={() => setResetOnboardingOpen(true)}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-12 w-12 shrink-0 rounded-full border-2 border-border bg-background text-foreground shadow-xl backdrop-blur-sm hover:bg-muted/90"
                aria-label="Command palette: reorder, hide or show sections"
                title="Command palette (⌘K or Ctrl+K): reorder, hide or show sections"
                onClick={() => setCommandOpen(true)}
              >
                <LayoutList className="h-5 w-5" />
              </Button>
            </div>
            <StudioCommandPalette
              open={commandOpen}
              onOpenChange={setCommandOpen}
              content={draftContent}
              onContentChange={setDraftContent}
              theme={theme}
              onTheme={setTheme}
              published={published}
              onPublished={setPublished}
              onOpenSheet={(t) => {
                openSheet(t);
              }}
              publicUrl={published && slug.trim() ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${encodeURIComponent(slug.trim())}` : undefined}
              onRequestPortfolioReset={() => setResetOnboardingOpen(true)}
            />
          </>
        ) : null}
      </div>

      <Sheet open={sheet !== null} onOpenChange={(o) => !o && closeSheet()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {sheet === 'hero' && 'Identity'}
              {sheet === 'featured' && 'Featured projects'}
              {sheet === 'howIBuild' && 'How I build'}
              {sheet === 'skills' && 'Skills'}
              {sheet === 'experience' && 'Experience & education'}
              {sheet === 'proof' && 'Activity'}
              {typeof sheet === 'string' && sheet.startsWith('project-') && 'Project'}
            </SheetTitle>
          </SheetHeader>
          {sheet === 'hero' && (
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-xs">Role / title</Label>
                <div className="flex gap-2">
                  <Input
                    value={draftContent.hero.roleTitle ?? ''}
                    onChange={(e) =>
                      setDraftContent({
                        ...draftContent,
                        hero: { ...draftContent.hero, roleTitle: e.target.value },
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!!suggestLoading}
                    onClick={async () => {
                      setSuggestLoading('roleTitle');
                      try {
                        const key = getStudioGeminiKey();
                        const r = await suggestPortfolioField({
                          field: 'roleTitle',
                          text: draftContent.hero.roleTitle ?? '',
                          geminiApiKey: key ?? undefined,
                          portfolioContext: buildPortfolioSuggestContext(draftContent),
                        });
                        if (r.suggestions[0]) {
                          setDraftContent({
                            ...draftContent,
                            hero: { ...draftContent.hero, roleTitle: r.suggestions[0] },
                          });
                        } else {
                          toast({
                            title: 'No suggestions',
                            description: 'Add a BYO key or server Gemini.',
                          });
                        }
                      } finally {
                        setSuggestLoading(null);
                      }
                    }}
                  >
                    {suggestLoading === 'roleTitle' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Tagline</Label>
                <div className="flex gap-2">
                  <Input
                    value={draftContent.hero.tagline ?? ''}
                    onChange={(e) =>
                      setDraftContent({
                        ...draftContent,
                        hero: { ...draftContent.hero, tagline: e.target.value },
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!!suggestLoading}
                    onClick={async () => {
                      setSuggestLoading('tagline');
                      try {
                        const key = getStudioGeminiKey();
                        const r = await suggestPortfolioField({
                          field: 'tagline',
                          text: draftContent.hero.tagline ?? '',
                          geminiApiKey: key ?? undefined,
                          portfolioContext: buildPortfolioSuggestContext(draftContent),
                        });
                        if (r.suggestions[0]) {
                          setDraftContent({
                            ...draftContent,
                            hero: { ...draftContent.hero, tagline: r.suggestions[0] },
                          });
                        } else {
                          toast({ title: 'No suggestions' });
                        }
                      } finally {
                        setSuggestLoading(null);
                      }
                    }}
                  >
                    {suggestLoading === 'tagline' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Bio</Label>
                <Textarea
                  className="min-h-[100px] text-sm"
                  value={draftContent.hero.bio ?? ''}
                  onChange={(e) =>
                    setDraftContent({
                      ...draftContent,
                      hero: { ...draftContent.hero, bio: e.target.value },
                    })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={!!suggestLoading}
                  onClick={async () => {
                    setSuggestLoading('bio');
                    try {
                      const key = getStudioGeminiKey();
                      const r = await suggestPortfolioField({
                        field: 'bio',
                        text: draftContent.hero.bio ?? '',
                        geminiApiKey: key ?? undefined,
                        portfolioContext: buildPortfolioSuggestContext(draftContent),
                      });
                      if (r.suggestions[0]) {
                        const rt = r.roleTitleSuggestions?.[0]?.trim();
                        setDraftContent({
                          ...draftContent,
                          hero: {
                            ...draftContent.hero,
                            bio: r.suggestions[0],
                            roleTitle: rt
                              ? rt.slice(0, 120)
                              : draftContent.hero.roleTitle?.slice(0, 120),
                          },
                        });
                      } else {
                        toast({ title: 'No suggestions' });
                      }
                    } finally {
                      setSuggestLoading(null);
                    }
                  }}
                >
                  {suggestLoading === 'bio' ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-3 w-3" />
                  )}
                  Suggest
                </Button>
              </div>
              <div>
                <Label className="text-xs">Current focus</Label>
                <Textarea
                  className="min-h-[52px] text-sm"
                  placeholder="e.g. Distributed systems and compiler internals"
                  value={draftContent.hero.currentFocus ?? ''}
                  onChange={(e) =>
                    setDraftContent({
                      ...draftContent,
                      hero: { ...draftContent.hero, currentFocus: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Status line</Label>
                <Input
                  placeholder="Tiny pulse under your role"
                  value={draftContent.hero.statusLine ?? ''}
                  onChange={(e) =>
                    setDraftContent({
                      ...draftContent,
                      hero: { ...draftContent.hero, statusLine: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Strongest skill signal</Label>
                <Input
                  placeholder="e.g. Backend systems, TypeScript"
                  value={draftContent.hero.strongestSkill ?? ''}
                  onChange={(e) =>
                    setDraftContent({
                      ...draftContent,
                      hero: { ...draftContent.hero, strongestSkill: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Location</Label>
                <Input
                  value={draftContent.hero.location ?? ''}
                  onChange={(e) =>
                    setDraftContent({
                      ...draftContent,
                      hero: { ...draftContent.hero, location: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs">Profile photo URL</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 text-[11px]"
                    onClick={() => {
                      const login =
                        draftContent.studio?.githubLogin?.trim() ||
                        githubLoginFromProfileUrl(draftContent.hero.links?.github ?? '') ||
                        '';
                      if (!login) {
                        toast({
                          title: 'Add a GitHub profile URL first',
                          description: 'Set the GitHub link below, or connect GitHub in onboarding.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      setDraftContent({
                        ...draftContent,
                        hero: { ...draftContent.hero, avatarUrl: githubProfilePngUrl(login) },
                      });
                    }}
                  >
                    Use GitHub photo
                  </Button>
                </div>
                <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground">
                  Custom https image, or leave empty — visitors still see your GitHub picture when a GitHub link or
                  login is set.
                </p>
                <Input
                  placeholder="https://… (optional)"
                  value={draftContent.hero.avatarUrl ?? ''}
                  onChange={(e) =>
                    setDraftContent({
                      ...draftContent,
                      hero: { ...draftContent.hero, avatarUrl: e.target.value.trim() || null },
                    })
                  }
                />
                {!(draftContent.hero.avatarUrl ?? '').trim() &&
                resolvePortfolioHeroAvatarUrl(draftContent) ? (
                  <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/40 p-2">
                    <img
                      src={resolvePortfolioHeroAvatarUrl(draftContent)!}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
                    />
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Live preview uses your GitHub avatar until you paste a custom URL above.
                    </p>
                  </div>
                ) : null}
              </div>
              {(['github', 'linkedin', 'x', 'website', 'resumeUrl'] as const).map((k) => (
                <div key={k}>
                  <Label className="text-xs">
                    {k === 'resumeUrl' ? 'Resume URL' : k === 'x' ? 'X (Twitter)' : k.charAt(0).toUpperCase() + k.slice(1)}
                  </Label>
                  <Input
                    value={draftContent.hero.links?.[k] ?? ''}
                    onChange={(e) =>
                      setDraftContent({
                        ...draftContent,
                        hero: {
                          ...draftContent.hero,
                          links: { ...draftContent.hero.links, [k]: e.target.value },
                        },
                      })
                    }
                  />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftContent.hero.openToWork ?? false}
                  onCheckedChange={(v) =>
                    setDraftContent({
                      ...draftContent,
                      hero: { ...draftContent.hero, openToWork: v },
                    })
                  }
                />
                <Label className="text-xs">Open to work</Label>
              </div>
            </div>
          )}

          {sheet === 'proof' && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                Activity heatmaps are chosen by each visitor (DSA practice, GitHub, or combined). You cannot set that
                here—only whether this section stays in your layout (use section order / visibility from the canvas).
              </p>
            </div>
          )}

          {sheet === 'howIBuild' && (
            <div className="mt-4 space-y-3">
              <Label className="text-xs">Bullets (one per line)</Label>
              <Textarea
                className="font-mono text-sm"
                value={(draftContent.howIBuild?.bullets ?? []).join('\n')}
                onChange={(e) => {
                  const raw = e.target.value;
                  const bullets = parseBulletLinesPreserveTrail(raw, 5);
                  const interests = draftContent.howIBuild?.interests ?? [];
                  const hasAnything = raw.trim().length > 0 || interests.length > 0;
                  setDraftContent({
                    ...draftContent,
                    howIBuild: hasAnything ? { bullets, interests } : null,
                  });
                }}
              />
              <Label className="text-xs">Interests (comma-separated)</Label>
              <Input
                value={howIBuildInterestsText}
                onChange={(e) => {
                  const text = e.target.value;
                  setHowIBuildInterestsText(text);
                  const items = commaTagsFromTyping(text, 8);
                  const bullets = draftContent.howIBuild?.bullets ?? [];
                  const hasAnything =
                    text.trim().length > 0 || items.length > 0 || bullets.some((b) => b.trim().length > 0);
                  setDraftContent({
                    ...draftContent,
                    howIBuild: hasAnything ? { bullets, interests: items } : null,
                  });
                }}
                onBlur={() => {
                  const items = commaSeparatedToArray(howIBuildInterestsText, 8);
                  setHowIBuildInterestsText(joinCommaList(items));
                  const bullets = draftContent.howIBuild?.bullets ?? [];
                  const hasAnything =
                    items.length > 0 || bullets.some((b) => b.trim().length > 0);
                  setDraftContent({
                    ...draftContent,
                    howIBuild: hasAnything ? { bullets, interests: items } : null,
                  });
                }}
              />
            </div>
          )}

          {sheet === 'skills' && (
            <div className="mt-4 space-y-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraftContent((c) => {
                    if (!c) return c;
                    const skills = [...c.skills, { category: 'New', items: [] }];
                    setSkillsItemsDraft((d) => ({ ...d, [skills.length - 1]: '' }));
                    return { ...c, skills };
                  })
                }
              >
                Add category
              </Button>
              {draftContent.skills.map((cat, ci) => (
                <div key={ci} className="space-y-2 rounded border p-2">
                  <Input
                    value={cat.category}
                    onChange={(e) => {
                      const skills = [...draftContent.skills];
                      skills[ci] = { ...skills[ci], category: e.target.value };
                      setDraftContent({ ...draftContent, skills });
                    }}
                  />
                  <Textarea
                    placeholder="Comma-separated skills"
                    className="text-xs"
                    value={skillsItemsDraft[ci] ?? joinCommaList(cat.items)}
                    onChange={(e) =>
                      setSkillsItemsDraft((d) => ({
                        ...d,
                        [ci]: e.target.value,
                      }))
                    }
                    onBlur={() => {
                      const raw = skillsItemsDraft[ci] ?? joinCommaList(cat.items);
                      const items = commaSeparatedToArray(raw, 30);
                      setSkillsItemsDraft((d) => ({ ...d, [ci]: joinCommaList(items) }));
                      const skills = [...draftContent.skills];
                      if (JSON.stringify(skills[ci].items) === JSON.stringify(items)) return;
                      skills[ci] = { ...skills[ci], items };
                      setDraftContent({ ...draftContent, skills });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      const skills = draftContent.skills.filter((_, i) => i !== ci);
                      const nextDraft: Record<number, string> = {};
                      skills.forEach((c, i) => {
                        nextDraft[i] = joinCommaList(c.items);
                      });
                      setSkillsItemsDraft(nextDraft);
                      setDraftContent({ ...draftContent, skills });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {sheet === 'experience' && (
            <div className="mt-4 space-y-4">
              <p className="text-xs font-medium">Experience</p>
              {draftContent.experience.map((ex, i) => (
                <div key={i} className="space-y-2 rounded border p-2 text-xs">
                  <Input
                    placeholder="Title"
                    value={ex.title}
                    onChange={(e) => {
                      const experience = [...draftContent.experience];
                      experience[i] = { ...ex, title: e.target.value };
                      setDraftContent({ ...draftContent, experience });
                    }}
                  />
                  <Input
                    placeholder="Organization"
                    value={ex.org}
                    onChange={(e) => {
                      const experience = [...draftContent.experience];
                      experience[i] = { ...ex, org: e.target.value };
                      setDraftContent({ ...draftContent, experience });
                    }}
                  />
                  <div className={cn('grid gap-2', ex.current ? 'grid-cols-1' : 'grid-cols-2')}>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Start</Label>
                      <Input
                        type="month"
                        className="h-9 font-mono text-[11px]"
                        value={toMonthInputValue(ex.startDate)}
                        onChange={(e) => {
                          const v = e.target.value;
                          const experience = [...draftContent.experience];
                          experience[i] = { ...ex, startDate: v };
                          setDraftContent({ ...draftContent, experience });
                        }}
                      />
                    </div>
                    {!ex.current ? (
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">End</Label>
                        <Input
                          type="month"
                          className="h-9 font-mono text-[11px]"
                          value={toMonthInputValue(ex.endDate)}
                          onChange={(e) => {
                            const v = e.target.value;
                            const experience = [...draftContent.experience];
                            experience[i] = { ...ex, endDate: v || undefined };
                            setDraftContent({ ...draftContent, experience });
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`exp-cur-${i}`}
                      checked={!!ex.current}
                      onCheckedChange={(c) => {
                        const on = c === true;
                        const experience = [...draftContent.experience];
                        experience[i] = {
                          ...ex,
                          current: on,
                          endDate: on ? undefined : ex.endDate,
                        };
                        setDraftContent({ ...draftContent, experience });
                      }}
                    />
                    <Label htmlFor={`exp-cur-${i}`} className="text-xs font-normal leading-tight">
                      I currently work here
                    </Label>
                  </div>
                  {formatExperienceDateRange(ex) ? (
                    <p className="text-[10px] text-muted-foreground">
                      Shown as{' '}
                      <span className="font-medium text-foreground">{formatExperienceDateRange(ex)}</span>
                    </p>
                  ) : null}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Highlights (one bullet per line)</Label>
                    <Textarea
                      className="min-h-[100px] text-[11px]"
                      placeholder="One achievement per line"
                      value={(ex.bullets ?? []).join('\n')}
                      onChange={(e) => {
                        const bullets = parseBulletLinesPreserveTrail(e.target.value, 20);
                        const experience = [...draftContent.experience];
                        experience[i] = { ...ex, bullets: bullets.length ? bullets : undefined };
                        setDraftContent({ ...draftContent, experience });
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() =>
                      setDraftContent({
                        ...draftContent,
                        experience: draftContent.experience.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraftContent({
                    ...draftContent,
                    experience: [
                      ...draftContent.experience,
                      { title: '', org: '', startDate: '', current: false },
                    ],
                  })
                }
              >
                Add experience
              </Button>
              <p className="text-xs font-medium">Education</p>
              {draftContent.education.map((ed, i) => (
                <div key={i} className="space-y-2 rounded border p-2 text-xs">
                  <Input
                    placeholder="School"
                    value={ed.school}
                    onChange={(e) => {
                      const education = [...draftContent.education];
                      education[i] = { ...ed, school: e.target.value };
                      setDraftContent({ ...draftContent, education });
                    }}
                  />
                  <Input
                    placeholder="Degree / program"
                    value={ed.degree}
                    onChange={(e) => {
                      const education = [...draftContent.education];
                      education[i] = { ...ed, degree: e.target.value };
                      setDraftContent({ ...draftContent, education });
                    }}
                  />
                  <div className={cn('grid gap-2', ed.current ? 'grid-cols-1' : 'grid-cols-2')}>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Start</Label>
                      <Input
                        type="month"
                        className="h-9 font-mono text-[11px]"
                        value={toMonthInputValue(ed.startDate)}
                        onChange={(e) => {
                          const v = e.target.value;
                          const education = [...draftContent.education];
                          education[i] = { ...ed, startDate: v || undefined };
                          setDraftContent({ ...draftContent, education });
                        }}
                      />
                    </div>
                    {!ed.current ? (
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">End (graduation)</Label>
                        <Input
                          type="month"
                          className="h-9 font-mono text-[11px]"
                          value={toMonthInputValue(ed.endDate)}
                          onChange={(e) => {
                            const v = e.target.value;
                            const education = [...draftContent.education];
                            education[i] = { ...ed, endDate: v || undefined };
                            setDraftContent({ ...draftContent, education });
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`edu-cur-${i}`}
                      checked={!!ed.current}
                      onCheckedChange={(c) => {
                        const on = c === true;
                        const education = [...draftContent.education];
                        education[i] = {
                          ...ed,
                          current: on,
                          endDate: on ? undefined : ed.endDate,
                        };
                        setDraftContent({ ...draftContent, education });
                      }}
                    />
                    <Label htmlFor={`edu-cur-${i}`} className="text-xs font-normal leading-tight">
                      Still enrolled
                    </Label>
                  </div>
                  {formatEducationDateRange(ed) ? (
                    <p className="text-[10px] text-muted-foreground">
                      Shown as{' '}
                      <span className="font-medium text-foreground">{formatEducationDateRange(ed)}</span>
                    </p>
                  ) : null}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Details &amp; highlights</Label>
                    <Textarea
                      className="min-h-[100px] text-[11px]"
                      placeholder="Coursework, honors, clubs (one line per bullet is fine)"
                      value={ed.details ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.slice(0, 2000);
                        const education = [...draftContent.education];
                        education[i] = { ...ed, details: v || undefined };
                        setDraftContent({ ...draftContent, education });
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() =>
                      setDraftContent({
                        ...draftContent,
                        education: draftContent.education.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraftContent({
                    ...draftContent,
                    education: [
                      ...draftContent.education,
                      { school: '', degree: '', startDate: '', current: false },
                    ],
                  })
                }
              >
                Add education
              </Button>
            </div>
          )}

          {sheet === 'featured' && (
            <div className="mt-4 space-y-3">
              <Button
                size="sm"
                variant="outline"
                disabled={draftContent.projects.length >= 4}
                onClick={() =>
                  setDraftContent({
                    ...draftContent,
                    projects: [
                      ...draftContent.projects,
                      {
                        id: crypto.randomUUID(),
                        title: 'Project',
                        shortDescription: 'Summary',
                        techStack: [],
                        featured: true,
                      },
                    ],
                  })
                }
              >
                Add project
              </Button>
              {draftContent.projects.map((p, pi) => (
                <div key={p.id ?? pi} className="space-y-2 rounded border p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Project {pi + 1}</span>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setSheet(`project-${pi}`)}>
                      Full editor
                    </Button>
                  </div>
                  <Label className="text-[10px]">Title</Label>
                  <Input
                    value={p.title}
                    onChange={(e) => {
                      const projects = [...draftContent.projects];
                      projects[pi] = { ...p, title: e.target.value };
                      setDraftContent({ ...draftContent, projects });
                    }}
                  />
                  <Label className="text-[10px]">Hook</Label>
                  <Textarea
                    value={p.shortDescription}
                    onChange={(e) => {
                      const projects = [...draftContent.projects];
                      projects[pi] = { ...p, shortDescription: e.target.value };
                      setDraftContent({ ...draftContent, projects });
                    }}
                  />
                  <Label className="text-[10px]">Why it exists</Label>
                  <Textarea
                    className="min-h-[48px]"
                    value={p.whyBuilt ?? ''}
                    onChange={(e) => {
                      const projects = [...draftContent.projects];
                      projects[pi] = { ...p, whyBuilt: e.target.value };
                      setDraftContent({ ...draftContent, projects });
                    }}
                  />
                  <Label className="text-[10px]">Legacy long story</Label>
                  <Textarea
                    placeholder="Long story"
                    value={p.longDescription ?? ''}
                    onChange={(e) => {
                      const projects = [...draftContent.projects];
                      projects[pi] = { ...p, longDescription: e.target.value };
                      setDraftContent({ ...draftContent, projects });
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={p.featured !== false}
                      onCheckedChange={(c) => {
                        const projects = [...draftContent.projects];
                        projects[pi] = { ...p, featured: c === true };
                        setDraftContent({ ...draftContent, projects });
                      }}
                    />
                    <span>Featured</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() =>
                      setDraftContent({
                        ...draftContent,
                        projects: draftContent.projects.filter((_, j) => j !== pi),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {typeof sheet === 'string' && sheet.startsWith('project-') ? (
            (() => {
              const i = parseInt(sheet.slice('project-'.length), 10);
              const p = draftContent.projects[i];
              if (!p) return null;
              const patchProject = (next: PortfolioProject) => {
                const projects = [...draftContent.projects];
                projects[i] = next;
                setDraftContent({ ...draftContent, projects });
              };
              return (
                <div className="mt-4 space-y-4 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!!suggestLoading}
                      onClick={async () => {
                        setSuggestLoading(`project-${i}`);
                        try {
                          const key = getStudioGeminiKey();
                          const stack = (p.techStack ?? []).join(', ');
                          const notes = [p.longDescription, p.shortDescription, p.whyBuilt]
                            .filter(Boolean)
                            .join('\n');
                          const r = await suggestPortfolioField({
                            field: 'projectScaffold',
                            projectTitle: p.title,
                            notes,
                            stack,
                            geminiApiKey: key ?? undefined,
                            portfolioContext: buildPortfolioSuggestContext(draftContent),
                          });
                          const sc = r.projectScaffold;
                          if (!sc) {
                            toast({
                              title: 'No scaffold returned',
                              description: 'Add a Gemini key (BYO or server) and try again.',
                            });
                            return;
                          }
                          const nextStory = {
                            motivation: p.story?.motivation?.trim()
                              ? p.story.motivation
                              : sc.storyPrompts.motivation,
                            architecture: p.story?.architecture?.trim()
                              ? p.story.architecture
                              : sc.storyPrompts.architecture,
                            challenges: p.story?.challenges?.trim()
                              ? p.story.challenges
                              : sc.storyPrompts.challenges,
                            lessons: p.story?.lessons?.trim() ? p.story.lessons : sc.storyPrompts.lessons,
                            futurePlans: p.story?.futurePlans?.trim()
                              ? p.story.futurePlans
                              : sc.storyPrompts.futurePlans,
                          };
                          patchProject({
                            ...p,
                            whyBuilt: p.whyBuilt?.trim() ? p.whyBuilt : sc.whyBuiltStubs[0] ?? p.whyBuilt,
                            engineeringHighlights:
                              (p.engineeringHighlights?.length ?? 0) > 0
                                ? p.engineeringHighlights
                                : sc.highlights,
                            story: nextStory,
                          });
                        } finally {
                          setSuggestLoading(null);
                        }
                      }}
                    >
                      {suggestLoading === `project-${i}` ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-3 w-3" />
                      )}
                      AI: draft scaffolding
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={p.title}
                      onChange={(e) => patchProject({ ...p, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Hook (short)</Label>
                    <Textarea
                      className="min-h-[56px]"
                      value={p.shortDescription}
                      onChange={(e) => patchProject({ ...p, shortDescription: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Why it exists</Label>
                    <Textarea
                      className="min-h-[56px]"
                      placeholder="Problem / intent — not generic marketing"
                      value={p.whyBuilt ?? ''}
                      onChange={(e) => patchProject({ ...p, whyBuilt: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Legacy long story (optional)</Label>
                    <Textarea
                      placeholder="Single block; prefer structured sections below"
                      className="min-h-[80px] font-mono text-xs"
                      value={p.longDescription ?? ''}
                      onChange={(e) => patchProject({ ...p, longDescription: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Engineering highlights (one per line)</Label>
                    <Textarea
                      className="min-h-[72px] font-mono text-xs"
                      value={(p.engineeringHighlights ?? []).join('\n')}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const lines = parseBulletLinesPreserveTrail(raw, 8);
                        patchProject({
                          ...p,
                          engineeringHighlights: lines.some((l) => l.trim()) ? lines : undefined,
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Signal cues (comma)</Label>
                    <Input
                      placeholder="Open source, Production, In progress"
                      value={projectSignalText[i] ?? joinCommaList(p.signalCues ?? [])}
                      onChange={(e) => {
                        const text = e.target.value;
                        setProjectSignalText((d) => ({ ...d, [i]: text }));
                        const signalCues = commaTagsFromTyping(text, 10);
                        patchProject({
                          ...p,
                          signalCues: signalCues.length ? signalCues : undefined,
                        });
                      }}
                      onBlur={() => {
                        const raw = projectSignalText[i] ?? joinCommaList(p.signalCues ?? []);
                        const signalCues = commaSeparatedToArray(raw, 10);
                        setProjectSignalText((d) => {
                          const n = { ...d };
                          delete n[i];
                          return n;
                        });
                        patchProject({
                          ...p,
                          signalCues: signalCues.length ? signalCues : undefined,
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Extra metrics (optional, one per line: Label: value)</Label>
                    <Textarea
                      className="min-h-[72px] font-mono text-xs"
                      placeholder={'LOC: 4k\nContributors: 2'}
                      value={projectMetricsText[i] ?? metricsTextFromRecord(p.metrics)}
                      onChange={(e) =>
                        setProjectMetricsText((d) => ({
                          ...d,
                          [i]: e.target.value,
                        }))
                      }
                      onBlur={() => {
                        const raw = projectMetricsText[i] ?? metricsTextFromRecord(p.metrics);
                        const metrics = metricsRecordFromText(raw);
                        setProjectMetricsText((d) => {
                          const n = { ...d };
                          delete n[i];
                          return n;
                        });
                        patchProject({
                          ...p,
                          metrics: Object.keys(metrics).length ? metrics : undefined,
                        });
                      }}
                    />
                  </div>
                  {(
                    [
                      ['motivation', 'Motivation'],
                      ['architecture', 'Architecture'],
                      ['challenges', 'Challenges'],
                      ['lessons', 'Lessons'],
                      ['futurePlans', "What's next"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <Label className="text-xs">{label}</Label>
                      <Textarea
                        className="min-h-[64px] text-xs"
                        value={(p.story?.[key] as string | undefined) ?? ''}
                        onChange={(e) => {
                          patchProject({
                            ...p,
                            story: { ...p.story, [key]: e.target.value },
                          });
                        }}
                      />
                    </div>
                  ))}
                  <div className="space-y-2 rounded border p-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Story images (https)</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={() => {
                          const storyImages = [...(p.storyImages ?? [])];
                          storyImages.push({ url: 'https://', after: 'motivation' });
                          patchProject({ ...p, storyImages });
                        }}
                      >
                        Add image
                      </Button>
                    </div>
                    {(p.storyImages ?? []).map((im, ii) => (
                      <div key={ii} className="flex flex-col gap-1 border-b pb-2 last:border-0">
                        <Input
                          placeholder="https://…"
                          value={im.url}
                          onChange={(e) => {
                            const storyImages = [...(p.storyImages ?? [])];
                            storyImages[ii] = { ...im, url: e.target.value };
                            patchProject({ ...p, storyImages });
                          }}
                        />
                        <Input
                          placeholder="Caption (optional)"
                          value={im.caption ?? ''}
                          onChange={(e) => {
                            const storyImages = [...(p.storyImages ?? [])];
                            storyImages[ii] = { ...im, caption: e.target.value };
                            patchProject({ ...p, storyImages });
                          }}
                        />
                        <label className="text-[10px] text-muted-foreground">
                          Insert after
                          <select
                            className="ml-2 rounded border bg-background px-1 py-0.5 text-[10px]"
                            value={im.after}
                            onChange={(e) => {
                              const storyImages = [...(p.storyImages ?? [])];
                              storyImages[ii] = { ...im, after: e.target.value as PortfolioStoryImageAfter };
                              patchProject({ ...p, storyImages });
                            }}
                          >
                            {(
                              [
                                'motivation',
                                'architecture',
                                'challenges',
                                'lessons',
                                'futurePlans',
                              ] as const
                            ).map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-destructive"
                          onClick={() => {
                            const storyImages = (p.storyImages ?? []).filter((_, j) => j !== ii);
                            patchProject({ ...p, storyImages: storyImages.length ? storyImages : undefined });
                          }}
                        >
                          Remove image
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label className="text-xs">Tech (comma)</Label>
                    <Input
                      value={projectTechText[i] ?? joinCommaList(p.techStack ?? [])}
                      onChange={(e) => {
                        const text = e.target.value;
                        setProjectTechText((d) => ({ ...d, [i]: text }));
                        const techStack = commaTagsFromTyping(text, 20);
                        patchProject({
                          ...p,
                          techStack: techStack.some((t) => t.trim()) ? techStack : [],
                        });
                      }}
                      onBlur={() => {
                        const raw = projectTechText[i] ?? joinCommaList(p.techStack ?? []);
                        const techStack = commaSeparatedToArray(raw, 20);
                        setProjectTechText((d) => {
                          const n = { ...d };
                          delete n[i];
                          return n;
                        });
                        patchProject({
                          ...p,
                          techStack: techStack.length ? techStack : [],
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">GitHub URL</Label>
                    <Input
                      value={p.githubUrl ?? ''}
                      onChange={(e) => patchProject({ ...p, githubUrl: e.target.value })}
                    />
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{repoInsightStudioCaption(p)}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Live URL</Label>
                    <Input
                      value={p.liveUrl ?? ''}
                      onChange={(e) => patchProject({ ...p, liveUrl: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Banner / screenshot URL</Label>
                    <Input
                      value={p.imageUrl ?? ''}
                      onChange={(e) => patchProject({ ...p, imageUrl: e.target.value })}
                    />
                  </div>
                </div>
              );
            })()
          ) : null}

          <Button className="mt-6 w-full" onClick={closeSheet}>
            Done
          </Button>
        </SheetContent>
      </Sheet>
      {portfolioResetDialog}
    </>
  );
};

export default PortfolioStudioPage;
