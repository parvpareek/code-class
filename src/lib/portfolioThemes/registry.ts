import type { PortfolioTheme } from '@/types/portfolio';

/** Standard color tokens vs cinematic signature themes. */
export type PortfolioThemeTier = 'standard' | 'signature';

/** Solid colors for theme picker rows (aligned with `portfolio-themes.css` tokens). */
export type PortfolioThemePickerPalette = {
  surface: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
};

export type PortfolioThemeOption = {
  id: PortfolioTheme;
  label: string;
  description?: string;
  tier: PortfolioThemeTier;
  /** Studio picker row preview */
  picker: PortfolioThemePickerPalette;
};

export const SIGNATURE_THEME_CATEGORY_LABEL = 'Signature';

export const PORTFOLIO_THEME_OPTIONS: PortfolioThemeOption[] = [
  {
    id: 'VOID',
    label: 'Void',
    description: 'Calm dark, subtle noise, cool accents',
    tier: 'standard',
    picker: {
      surface: '#101010',
      text: '#ececec',
      muted: '#8b939e',
      accent: '#e8eaed',
      border: '#2a3038',
    },
  },
  {
    id: 'PAPER',
    label: 'Paper',
    description: 'Warm editorial light',
    tier: 'standard',
    picker: {
      surface: '#fffcf7',
      text: '#141210',
      muted: '#6b6560',
      accent: '#3d3a36',
      border: '#e0d9ce',
    },
  },
  {
    id: 'EMBER',
    label: 'Vimal',
    description: 'Late-night craft, warm glow',
    tier: 'standard',
    picker: {
      surface: '#1e0f0d',
      text: '#f5ebe5',
      muted: '#b8a099',
      accent: '#ea580c',
      border: '#4a3028',
    },
  },
  {
    id: 'FROST',
    label: 'Frost',
    description: 'Cold clarity, frosted surfaces',
    tier: 'standard',
    picker: {
      surface: '#1a2838',
      text: '#e8eef5',
      muted: '#8b9aad',
      accent: '#7dd3fc',
      border: '#2d3f52',
    },
  },
  {
    id: 'GLACIER',
    label: 'Glacier',
    description: 'Technical cyan ice',
    tier: 'standard',
    picker: {
      surface: '#0f2840',
      text: '#e0f7ff',
      muted: '#6eb8d4',
      accent: '#22d3ee',
      border: '#1a5065',
    },
  },
  {
    id: 'PAAN',
    label: 'Paan',
    description: 'Deep green luxury accent',
    tier: 'standard',
    picker: {
      surface: '#0c221e',
      text: '#e8f0ee',
      muted: '#9ca8a5',
      accent: '#34d399',
      border: '#1a3d34',
    },
  },
  {
    id: 'FORMULA_ONE',
    label: 'F1',
    description: 'Signature — night circuit, precision grid & telemetry',
    tier: 'signature',
    picker: {
      surface: '#0e141f',
      text: '#e8eef5',
      muted: '#6b7d92',
      accent: '#3dd4c0',
      border: '#1a2635',
    },
  },
  {
    id: 'MARLBORO',
    label: 'Marlboro',
    description: 'Signature — editorial red & poster layout',
    tier: 'signature',
    picker: {
      surface: '#fffefa',
      text: '#0c0c0c',
      muted: '#8a8580',
      accent: '#b3131d',
      border: '#e4ddd4',
    },
  },
];

export const STANDARD_PORTFOLIO_THEME_OPTIONS = PORTFOLIO_THEME_OPTIONS.filter((o) => o.tier === 'standard');
export const SIGNATURE_PORTFOLIO_THEME_OPTIONS = PORTFOLIO_THEME_OPTIONS.filter((o) => o.tier === 'signature');

export const PORTFOLIO_THEME_IDS: PortfolioTheme[] = PORTFOLIO_THEME_OPTIONS.map((o) => o.id);

export const SIGNATURE_THEME_IDS: PortfolioTheme[] = SIGNATURE_PORTFOLIO_THEME_OPTIONS.map((o) => o.id);

export function isSignaturePortfolioTheme(theme: PortfolioTheme): boolean {
  return SIGNATURE_THEME_IDS.includes(theme);
}

/** Studio picker: legacy DB themes fall back to first standard option for preview row. */
export function getStudioThemeOption(theme: PortfolioTheme): PortfolioThemeOption {
  return PORTFOLIO_THEME_OPTIONS.find((o) => o.id === theme) ?? PORTFOLIO_THEME_OPTIONS[0];
}
