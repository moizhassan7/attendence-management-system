/** Seniority-friendly short labels so chart ticks do not wrap onto the next rank. */
const RANK_CHART_LABELS: Record<string, string> = {
  INSPECTOR: 'Inspector',
  'INSPECTOR LEGAL': 'Insp. Legal',
  'SUB INSPECTOR': 'Sub Inspector',
  ASI: 'ASI',
  'HEAD CONSTABLE': 'Head Constable',
  'HEAD CONSTABLE DRIVER': 'HC Driver',
  'LADY HC': 'Lady HC',
  CONSTABLE: 'Constable',
  'CONSTABLE DRIVER': 'Ct. Driver',
  'CONSTABLE (EX-ARMY)': 'Ct. Ex-Army',
  'BAND CONSTABLE': 'Band Constable',
};

const RANK_DISPLAY_NAMES: Record<string, string> = {
  INSPECTOR: 'Inspector',
  'INSPECTOR LEGAL': 'Inspector Legal',
  'SUB INSPECTOR': 'Sub Inspector',
  ASI: 'ASI',
  'HEAD CONSTABLE': 'Head Constable',
  'HEAD CONSTABLE DRIVER': 'Head Constable Driver',
  'LADY HC': 'Lady HC',
  CONSTABLE: 'Constable',
  'CONSTABLE DRIVER': 'Constable Driver',
  'CONSTABLE (EX-ARMY)': 'Constable (Ex-Army)',
  'BAND CONSTABLE': 'Band Constable',
};

function rankKey(name: string | null | undefined): string {
  return (name || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function rankDisplayName(name: string | null | undefined): string {
  const raw = (name || '').trim();
  if (!raw) return '—';
  return RANK_DISPLAY_NAMES[rankKey(raw)] || raw;
}

export function rankChartLabel(name: string | null | undefined): string {
  const raw = (name || '').trim();
  if (!raw) return '—';
  return RANK_CHART_LABELS[rankKey(raw)] || rankDisplayName(raw);
}
