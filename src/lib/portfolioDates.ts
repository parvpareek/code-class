import type { PortfolioEducation, PortfolioExperience } from '@/types/portfolio';

const YM = /^\d{4}-\d{2}$/;

/** Display label for YYYY-MM or plain year, or pass-through for other strings. */
export function formatPortfolioMonthLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const low = t.toLowerCase();
  if (low === 'present' || low === 'now' || low === 'current') return 'Present';
  if (YM.test(t)) {
    const [y, m] = t.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  if (/^\d{4}$/.test(t)) return t;
  return t;
}

export function formatExperienceDateRange(ex: PortfolioExperience): string {
  const s = formatPortfolioMonthLabel(ex.startDate ?? '');
  if (ex.current) return s ? `${s}–Present` : 'Present';
  const e = formatPortfolioMonthLabel(ex.endDate ?? '');
  if (s && e) return `${s}–${e}`;
  if (s) return s;
  return e;
}

export function formatEducationDateRange(ed: PortfolioEducation): string {
  const s = formatPortfolioMonthLabel(ed.startDate ?? '');
  if (ed.current) return s ? `${s}–Present` : 'Present';
  const e = formatPortfolioMonthLabel(ed.endDate ?? '');
  if (s && e) return `${s}–${e}`;
  if (s) return s;
  return e;
}

/** Value for <input type="month" /> or '' when not YYYY-MM. */
export function toMonthInputValue(raw: string | undefined): string {
  const t = (raw ?? '').trim();
  return YM.test(t) ? t : '';
}
