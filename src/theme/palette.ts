export const UI_TOKEN_VALUES = {
  bg: {
    pageTop: '#F8FAFC',
    pageBottom: '#EEF2F7',
    pageAccent: '#E2E8F0',
    stripe: 'rgba(148, 163, 184, 0.18)',
  },
  surface: {
    base: '#FFFFFF',
    soft: '#F3F6FA',
    muted: '#E8EEF6',
    raised: '#FFFFFF',
    inset: '#E2E8F0',
  },
  text: {
    strong: '#0F172A',
    body: '#1E293B',
    muted: '#64748B',
    faint: '#94A3B8',
    inverse: '#FFFFFF',
  },
  brand: {
    primary: '#2563EB',
    secondary: '#0EA5E9',
    cta: '#F97316',
  },
  state: {
    success: '#10B981',
    warning: '#EAB308',
    danger: '#EF4444',
    info: '#3B82F6',
    special: '#8B5CF6',
  },
  border: {
    soft: '#E2E8F0',
    strong: '#CBD5E1',
    active: '#2563EB',
    dark: '#0F172A',
  },
  shadow: {
    panel: '0 18px 40px rgba(15, 23, 42, 0.10)',
    raised: '0 20px 44px rgba(37, 99, 235, 0.16)',
    cta: '0 24px 40px rgba(249, 115, 22, 0.24)',
    focus: '0 0 0 4px rgba(37, 99, 235, 0.16)',
  },
  radius: {
    panel: '20px',
    card: '16px',
    battle: '14px',
    pill: '999px',
  },
  motion: {
    fast: '160ms',
    base: '220ms',
    slow: '320ms',
  },
} as const;

export const UI_TOKENS = {
  bg: {
    pageTop: 'var(--pf-bg-page-top)',
    pageBottom: 'var(--pf-bg-page-bottom)',
    pageAccent: 'var(--pf-bg-page-accent)',
    stripe: 'var(--pf-bg-stripe)',
  },
  surface: {
    base: 'var(--pf-surface-base)',
    soft: 'var(--pf-surface-soft)',
    muted: 'var(--pf-surface-muted)',
    raised: 'var(--pf-surface-raised)',
    inset: 'var(--pf-surface-inset)',
  },
  text: {
    strong: 'var(--pf-text-strong)',
    body: 'var(--pf-text-body)',
    muted: 'var(--pf-text-muted)',
    faint: 'var(--pf-text-faint)',
    inverse: 'var(--pf-text-inverse)',
  },
  brand: {
    primary: 'var(--pf-brand-primary)',
    secondary: 'var(--pf-brand-secondary)',
    cta: 'var(--pf-brand-cta)',
  },
  state: {
    success: 'var(--pf-state-success)',
    warning: 'var(--pf-state-warning)',
    danger: 'var(--pf-state-danger)',
    info: 'var(--pf-state-info)',
    special: 'var(--pf-state-special)',
  },
  border: {
    soft: 'var(--pf-border-soft)',
    strong: 'var(--pf-border-strong)',
    active: 'var(--pf-border-active)',
    dark: 'var(--pf-border-dark)',
  },
  shadow: {
    panel: 'var(--pf-shadow-panel)',
    raised: 'var(--pf-shadow-raised)',
    cta: 'var(--pf-shadow-cta)',
    focus: 'var(--pf-shadow-focus)',
  },
  radius: {
    panel: 'var(--pf-radius-panel)',
    card: 'var(--pf-radius-card)',
    battle: 'var(--pf-radius-battle)',
    pill: 'var(--pf-radius-pill)',
  },
  motion: {
    fast: 'var(--pf-motion-fast)',
    base: 'var(--pf-motion-base)',
    slow: 'var(--pf-motion-slow)',
  },
} as const;

export const APP_PALETTE = {
  page: {
    backgroundTop: UI_TOKENS.bg.pageTop,
    backgroundBottom: UI_TOKENS.bg.pageBottom,
    backgroundAccent: UI_TOKENS.bg.pageAccent,
    stripe: UI_TOKENS.bg.stripe,
  },
  surface: {
    panel: UI_TOKENS.surface.base,
    panelSoft: UI_TOKENS.surface.soft,
    panelMuted: UI_TOKENS.surface.muted,
    raised: UI_TOKENS.surface.raised,
    inset: UI_TOKENS.surface.inset,
    chip: UI_TOKENS.surface.muted,
  },
  text: {
    onPanel: UI_TOKENS.text.strong,
    onPanelMuted: UI_TOKENS.text.muted,
    onPanelFaint: UI_TOKENS.text.faint,
    onInverse: UI_TOKENS.text.inverse,
    onPage: UI_TOKENS.text.strong,
    onPageMuted: UI_TOKENS.text.muted,
  },
  accent: {
    primary: UI_TOKENS.brand.primary,
    secondary: UI_TOKENS.brand.secondary,
    cta: UI_TOKENS.brand.cta,
    success: UI_TOKENS.state.success,
    warning: UI_TOKENS.state.warning,
    danger: UI_TOKENS.state.danger,
    info: UI_TOKENS.state.info,
    special: UI_TOKENS.state.special,
    neutral: UI_TOKENS.text.faint,
  },
  border: {
    strong: UI_TOKENS.border.strong,
    soft: UI_TOKENS.border.soft,
    active: UI_TOKENS.border.active,
    dark: UI_TOKENS.border.dark,
  },
  shadow: {
    panel: UI_TOKENS.shadow.panel,
    raised: UI_TOKENS.shadow.raised,
    cta: UI_TOKENS.shadow.cta,
    focus: UI_TOKENS.shadow.focus,
  },
  radius: UI_TOKENS.radius,
  motion: UI_TOKENS.motion,
} as const;

export type AppPalette = typeof APP_PALETTE;
