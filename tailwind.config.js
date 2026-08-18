/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 8章 カラーパレット。値は tokens.css の CSS 変数から引く。
        ink: 'var(--c-ink-navy)',
        chart: 'var(--c-chart-teal)',
        stone: 'var(--c-stone-white)',
        brass: 'var(--c-brass-gold)',
        brick: 'var(--c-brick-coral)',
        amber: 'var(--c-amber)',
        'text-ink': 'var(--c-text-ink)',
        'text-porcelain': 'var(--c-text-porcelain)',
      },
      fontFamily: {
        display: 'var(--f-display)',
        body: 'var(--f-body)',
        mono: 'var(--f-mono)',
      },
      fontSize: {
        'display-xl': ['clamp(40px, 9vw, 64px)', { lineHeight: '1.02', letterSpacing: '-0.02em' }],
        'display-l': ['clamp(32px, 6vw, 48px)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-m': ['clamp(24px, 4.5vw, 32px)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'stat-l': ['20px', { lineHeight: '1.2', letterSpacing: '0.01em' }],
        'stat-s': ['14px', { lineHeight: '1.3', letterSpacing: '0.04em' }],
      },
      borderRadius: { card: '20px', sheet: '24px' },
      boxShadow: {
        card: '0 18px 44px -24px rgba(14, 21, 33, 0.45)',
        sheet: '0 24px 60px -20px rgba(14, 21, 33, 0.55)',
      },
      transitionTimingFunction: { passage: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
    },
  },
  plugins: [],
}
