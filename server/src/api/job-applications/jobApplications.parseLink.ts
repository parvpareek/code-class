import axios from 'axios';

const FETCH_MS = 8_000;
const MAX_BYTES = 500_000;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function metaContent(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta\\s+(?:property|name)="${prop}"\\s+content="([^"]*)"`,
    'i'
  );
  const m = html.match(re);
  return m?.[1] ? decodeEntities(m[1]).trim() || null : null;
}

function titleFromHtml(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1] ? decodeEntities(m[1].trim()) || null : null;
}

function linkedInHints(url: URL): { company?: string; role?: string } {
  const out: { company?: string; role?: string } = {};
  const path = url.pathname.toLowerCase();
  const companyMatch = path.match(/\/company\/([^/]+)\//);
  if (companyMatch) {
    const slug = companyMatch[1].replace(/-/g, ' ');
    out.company = slug
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  const jobsCollect = path.match(/\/jobs\/collections\/[^/]+\/([^/?]+)/);
  if (jobsCollect) {
    const slug = jobsCollect[1].replace(/-/g, ' ');
    out.role = slug
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return out;
}

function splitTitle(title: string): { company?: string; role?: string } {
  const t = title.replace(/\s+/g, ' ').trim();
  const at = t.match(/^(.+?)\s+at\s+(.+)$/i);
  if (at) {
    return { role: at[1].trim(), company: at[2].replace(/\s*[|·].*$/, '').trim() };
  }
  const pipe = t.split(/\s*[|\u2013\u2014]\s*/);
  if (pipe.length >= 2) {
    return { role: pipe[0].trim(), company: pipe[pipe.length - 1].replace(/\s*LinkedIn.*$/i, '').trim() };
  }
  return {};
}

export async function parseJobLink(rawUrl: string): Promise<{ company?: string; role?: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return {};
  }
  if (!/^https?:$/i.test(url.protocol)) {
    return {};
  }

  const hints = url.hostname.includes('linkedin.com') ? linkedInHints(url) : {};

  try {
    const res = await axios.get<string>(url.toString(), {
      timeout: FETCH_MS,
      responseType: 'text',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CodeClassJobs/1.0; +https://codeclass.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
      validateStatus: (s) => s >= 200 && s < 400,
    });
    const html = typeof res.data === 'string' ? res.data : '';
    const slice = html.slice(0, Math.min(html.length, MAX_BYTES));

    const ogTitle = metaContent(slice, 'og:title') || titleFromHtml(slice);
    let company = hints.company;
    let role = hints.role;
    if (ogTitle) {
      const sp = splitTitle(ogTitle);
      if (!company && sp.company) company = sp.company;
      if (!role && sp.role) role = sp.role;
      if (!role && !company && ogTitle.length < 120) {
        role = ogTitle.replace(/\s*[\u2013\u2014|\-]\s*LinkedIn.*$/i, '').trim();
      }
    }
    return { company, role };
  } catch {
    return hints.company || hints.role ? hints : {};
  }
}
