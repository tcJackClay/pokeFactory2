export const APP_PALETTE = {
  page: {
    backgroundTop: '#F8FAFC',
    backgroundBottom: '#EEF2F7',
  },
  surface: {
    panel: '#FFFFFF',
    panelSoft: '#F3F6FA',
    chip: '#E8EEF6',
  },
  text: {
    onPanel: '#0F172A',
    onPanelMuted: '#64748B',
    onPage: '#0F172A',
    onPageMuted: '#64748B',
  },
  accent: {
    primary: '#2563EB',
    secondary: '#0EA5E9',
    warning: '#EAB308',
    danger: '#EF4444',
    neutral: '#94A3B8',
  },
  border: {
    strong: '#CBD5E1',
    soft: '#E2E8F0',
  },
} as const;

export type AppPalette = typeof APP_PALETTE;
