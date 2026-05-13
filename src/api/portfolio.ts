import api from './axios';
import type {
  MyPortfolioDto,
  PublicPortfolioDto,
  PortfolioContent,
  PortfolioTheme,
} from '@/types/portfolio';
import type { GithubPreviewDto, PortfolioBulkAiFillPayload } from '@/lib/portfolioMerge';

export type { GithubPreviewDto } from '@/lib/portfolioMerge';

export async function getMyPortfolio(): Promise<MyPortfolioDto> {
  const { data } = await api.get<MyPortfolioDto>('/portfolio/me');
  return data;
}

export async function updateMyPortfolio(body: {
  slug?: string;
  published?: boolean;
  theme?: PortfolioTheme;
  content?: PortfolioContent;
}): Promise<MyPortfolioDto> {
  const { data } = await api.put<MyPortfolioDto>('/portfolio/me', body);
  return data;
}

export async function getPublicPortfolio(slug: string): Promise<PublicPortfolioDto> {
  const { data } = await api.get<PublicPortfolioDto>(`/portfolio/public/${encodeURIComponent(slug)}`);
  return data;
}

export async function parseResumePdf(file: File): Promise<{
  draft: Partial<PortfolioContent>;
  excerpt: string;
  resumeText?: string;
}> {
  const form = new FormData();
  form.append('resume', file);
  const { data } = await api.post<{
    draft: Partial<PortfolioContent>;
    excerpt: string;
    resumeText?: string;
  }>('/portfolio/me/parse-resume', form);
  return data;
}

export type ProjectScaffoldDto = {
  whyBuiltStubs: string[];
  highlights: string[];
  storyPrompts: {
    motivation: string;
    architecture: string;
    challenges: string;
    lessons: string;
    futurePlans: string;
  };
};

export async function suggestPortfolioField(
  body:
    | {
        field: 'tagline' | 'bio' | 'roleTitle';
        text: string;
        tone?: string;
        geminiApiKey?: string;
        portfolioContext?: string;
      }
    | {
        field: 'projectScaffold';
        projectTitle: string;
        notes?: string;
        stack?: string;
        portfolioContext?: string;
        geminiApiKey?: string;
      }
): Promise<{
  suggestions: string[];
  roleTitleSuggestions?: string[];
  projectScaffold?: ProjectScaffoldDto | null;
  aiEnabled: boolean;
  usedUserKey?: boolean;
  serverConfigured?: boolean;
}> {
  const { data } = await api.post<{
    suggestions: string[];
    roleTitleSuggestions?: string[];
    projectScaffold?: ProjectScaffoldDto | null;
    aiEnabled: boolean;
    usedUserKey?: boolean;
    serverConfigured?: boolean;
  }>('/portfolio/me/suggest', body);
  return data;
}

export async function fillPortfolioWithAi(body: {
  geminiApiKey: string;
  resumeText?: string;
  portfolioContext: string;
  projectSkeletons: Array<{ title: string; githubUrl?: string; techStack?: string[] }>;
}): Promise<PortfolioBulkAiFillPayload> {
  const { data } = await api.post('/portfolio/me/fill-with-ai', body, { timeout: 310_000 });
  return data;
}

export async function getGithubPreview(login: string): Promise<GithubPreviewDto> {
  const { data } = await api.get<GithubPreviewDto>('/portfolio/github-preview', {
    params: { login },
  });
  return data;
}

/** Plain-text README body from GitHub API (server proxies rate limits). */
export async function getGithubReadme(owner: string, repo: string): Promise<string> {
  const { data } = await api.get<{ text: string }>('/portfolio/github-readme', {
    params: { owner, repo },
  });
  return data.text;
}
