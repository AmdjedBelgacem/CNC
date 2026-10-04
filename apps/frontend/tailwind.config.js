/** @type {import('tailwindcss').Config} */
const withAlpha = (name) => `rgb(var(${name}) / <alpha-value>)`;
const sansStack = ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'];
const displayStack = ['var(--font-space-grotesk)', 'var(--font-inter)', 'ui-sans-serif', 'sans-serif'];

module.exports = {
  // MUST be 'class': the app toggles `.dark` on <html> (see ThemeProvider), and the
  // design tokens in globals.css also switch on that class. Leaving this at the default
  // ('media') made every `dark:` utility follow the OS setting while the tokens followed
  // the in-app toggle — so choosing dark on a light OS produced dark-on-dark text.
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: withAlpha('--c-primary'),
        'primary-foreground': withAlpha('--c-primary-foreground'),
        secondary: withAlpha('--c-secondary'),
        'secondary-foreground': withAlpha('--c-secondary-foreground'),
        accent: withAlpha('--c-accent'),
        'accent-foreground': withAlpha('--c-accent-foreground'),
        // Surfaces
        background: withAlpha('--c-background'),
        foreground: withAlpha('--c-foreground'),
        card: withAlpha('--c-card'),
        'card-foreground': withAlpha('--c-card-foreground'),
        popover: withAlpha('--c-popover'),
        'popover-foreground': withAlpha('--c-popover-foreground'),
        muted: withAlpha('--c-muted'),
        'muted-foreground': withAlpha('--c-muted-foreground'),
        'surface-raised': withAlpha('--c-surface-raised'),
        'surface-sunken': withAlpha('--c-surface-sunken'),
        overlay: withAlpha('--c-overlay'),
        // Lines
        border: withAlpha('--c-border'),
        'border-strong': withAlpha('--c-border-strong'),
        input: withAlpha('--c-input'),
        ring: withAlpha('--c-ring'),
        // Feedback
        destructive: withAlpha('--c-destructive'),
        'destructive-foreground': withAlpha('--c-destructive-foreground'),
        success: withAlpha('--c-success'),
        'success-foreground': withAlpha('--c-success-foreground'),
        warning: withAlpha('--c-warning'),
        'warning-foreground': withAlpha('--c-warning-foreground'),
        info: withAlpha('--c-info'),
        'info-foreground': withAlpha('--c-info-foreground'),
        // Builder text tokens
        'text-primary': withAlpha('--c-text-primary'),
        'text-secondary': withAlpha('--c-text-secondary'),
        'text-muted': withAlpha('--c-text-muted'),
        // Builder surface tokens
        'surface-container-lowest': withAlpha('--c-surface-container-lowest'),
        'surface-container-low': withAlpha('--c-surface-container-low'),
        'surface-container-high': withAlpha('--c-surface-container-high'),
        'secondary-container': withAlpha('--c-secondary-container'),
        'secondary-fixed': withAlpha('--c-secondary-fixed'),
        // Fixed-alpha treatments
        'glass-border': 'var(--color-glass-border)',
        'accent-glow': 'var(--color-accent-glow)',
        'on-primary': '#ffffff',
      },
      // Every rounded-* utility derives from --radius, so the theme editor's
      // radius control reshapes the entire product from one value.
      borderRadius: {
        none: '0',
        xs: 'calc(var(--radius) * 0.375)',
        sm: 'calc(var(--radius) * 0.5)',
        DEFAULT: 'calc(var(--radius) * 0.75)',
        md: 'calc(var(--radius) * 0.75)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) * 1.5)',
        '2xl': 'calc(var(--radius) * 2)',
        '3xl': 'calc(var(--radius) * 3)',
        full: '9999px',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      fontFamily: {
        sans: sansStack,
        display: displayStack,
        'display-hero': displayStack,
        'headline-lg': displayStack,
        'headline-md': displayStack,
        'stats-number': sansStack,
        'body-md': sansStack,
        'body-lg': sansStack,
        'label-sm': sansStack,
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'display-hero': ['clamp(2.75rem, 7vw, 5rem)', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['clamp(1.5rem, 3vw, 2.25rem)', { lineHeight: '1.15' }],
        'body-md': ['1rem', { lineHeight: '1.6' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        // Admin density steps. These were previously written as arbitrary
        // `text-[11px]` / `text-[13px]` in ~90 places; naming them keeps the
        // admin rhythm (13px labels, 11px micro) without arbitrary values.
        '13': ['13px', { lineHeight: '1.4' }],
        '2xs': ['11px', { lineHeight: '1.35' }],
      },
      spacing: {
        'margin-mobile': '1rem',
        'margin-desktop': '2.5rem',
      },
      maxWidth: {
        'container-max': '1440px',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-in-up': 'fade-in-up 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'scale-in': 'scale-in 160ms cubic-bezier(0.32, 0.72, 0, 1)',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [
    // Direction variants. Arabic flips the document with dir="rtl"; Tailwind ships no
    // built-in variant for that, so `rtl:` / `ltr:` target it explicitly. Prefer logical
    // properties (ms-/me-/ps-/pe-/start-/end-) over these where possible.
    function rtlVariants({ addVariant }) {
      addVariant('rtl', '[dir="rtl"] &');
      addVariant('ltr', '[dir="ltr"] &');
    },
  ],
};
