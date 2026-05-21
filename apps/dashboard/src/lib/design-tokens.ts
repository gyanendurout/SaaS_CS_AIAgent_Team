/**
 * JOOLA design tokens — JS-side mirror of the CSS variables declared in
 * globals.css. Used by SVG-rendering components (donuts, sparklines) that
 * need real color strings rather than `var(...)` references.
 */

export const TOKENS = {
  yellow:  '#F5E625',
  yellowDeep: '#D9CB1F',
  red:     '#FF3A4C',
  green:   '#34C77B',
  blue:    '#4E9DFF',
  orange:  '#FF8A1F',
  purple:  '#B47CFF',
  fg:      '#F5F4F1',
  fg2:     '#B8B8B8',
  fg3:     '#6B6B6B',
  fg4:     '#4A4A4A',
  line:    '#2A2A2A',
  line2:   '#3A3A3A',
  panel:   '#121212',
  panel2:  '#1A1A1A',
  panel3:  '#232323',
  bg:      '#0A0A0A',
} as const;

export type TokenKey = keyof typeof TOKENS;

/* Decision -> tone color map (mirrors decision-pill styles) */
export const DECISION_COLOR: Record<string, string> = {
  ELIGIBLE_FOR_DAMAGE_REVIEW: TOKENS.green,
  NOT_ELIGIBLE:               TOKENS.red,
  HUMAN_REVIEW_REQUIRED:      TOKENS.orange,
  WARRANTY_EXPIRED:           TOKENS.fg3,
  PROCESSING:                 TOKENS.yellow,
};

export const DECISION_LABEL: Record<string, string> = {
  ELIGIBLE_FOR_DAMAGE_REVIEW: 'Eligible',
  NOT_ELIGIBLE:               'Not eligible',
  HUMAN_REVIEW_REQUIRED:      'Human review',
  WARRANTY_EXPIRED:           'Expired',
  PROCESSING:                 'Processing',
};

export const DECISION_SHORT: Record<string, string> = {
  ELIGIBLE_FOR_DAMAGE_REVIEW: 'ELIGIBLE',
  NOT_ELIGIBLE:               'NOT ELIGIBLE',
  HUMAN_REVIEW_REQUIRED:      'HUMAN',
  WARRANTY_EXPIRED:           'EXPIRED',
  PROCESSING:                 'PROCESSING',
};

export const DECISION_CLASS: Record<string, string> = {
  ELIGIBLE_FOR_DAMAGE_REVIEW: 'eligible',
  NOT_ELIGIBLE:               'not-eligible',
  HUMAN_REVIEW_REQUIRED:      'review',
  WARRANTY_EXPIRED:           'expired',
  PROCESSING:                 'processing',
};
