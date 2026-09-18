/** WhatsApp automation emerald design system — ported from the LeadForGrow marketing site's own design tokens. */

export const BRAND = {
  green: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },
  hero: '#D2EDD0',
  heroLight: '#EEF8ED',
  heroMuted: '#c5e4c2',
  ink: '#111827',
  slate: '#64748B',
  muted: '#94A3B8',
  border: '#E2E8F0',
  surface: '#FAFDFA',
};

export const MARKETING = {
  page: 'min-h-screen bg-white text-[#111827]',
  section: 'py-10 md:py-14 lg:py-16',
  sectionTight: 'py-8 md:py-10',
  container: 'max-w-7xl mx-auto px-6 lg:px-8',
  containerNarrow: 'max-w-4xl mx-auto px-6 lg:px-8',
  containerWide: 'max-w-[1280px] mx-auto px-6 lg:px-8',
  overline: 'text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700',
  h1: 'font-[family-name:var(--font-plus-jakarta)] text-[2.25rem] sm:text-[2.75rem] lg:text-[3.25rem] font-bold tracking-[-0.02em] text-[#111827] leading-[1.08]',
  h2: 'font-[family-name:var(--font-plus-jakarta)] text-[1.75rem] sm:text-[2.25rem] font-bold tracking-[-0.02em] text-[#111827] leading-tight',
  h3: 'font-[family-name:var(--font-plus-jakarta)] text-xl font-semibold text-[#111827]',
  body: 'text-[15px] sm:text-base text-[#64748B] leading-relaxed',
  bodyLarge: 'text-lg sm:text-xl text-[#64748B] leading-relaxed',
  card: 'rounded-2xl border border-emerald-100/80 bg-white shadow-[0_1px_3px_rgba(6,95,70,0.04),0_8px_24px_rgba(6,95,70,0.06)]',
  cardHover:
    'transition-all duration-300 hover:shadow-[0_12px_40px_rgba(6,95,70,0.1)] hover:border-emerald-200/80 hover:-translate-y-0.5',
  btnPrimary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#111827] px-6 py-3 text-[15px] font-semibold text-white hover:bg-black transition-all duration-200 shadow-lg shadow-emerald-900/10',
  btnGreen:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-[15px] font-semibold text-white hover:bg-emerald-700 transition-all duration-200 shadow-lg shadow-emerald-600/20',
  btnOutline:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-6 py-3 text-[15px] font-semibold text-[#111827] hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-200',
  link: 'text-emerald-700 font-medium hover:text-emerald-800 transition-colors',
  gradientHero: 'bg-gradient-to-br from-[#D2EDD0] via-[#EEF8ED] to-white',
  gradientDark: 'bg-gradient-to-br from-[#064E3B] via-[#065F46] to-[#047857]',
  glass: 'bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(6,95,70,0.08)]',
};
