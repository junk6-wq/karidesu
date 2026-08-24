/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 8章 カラーパレット。値は tokens.css のチャンネル変数から引く。
        //
        // var(--c-xxx) をそのまま渡すと Tailwind が色を分解できず、
        // text-text-porcelain/45 のような不透明度指定が CSS を生成せずに
        // 黙って捨てられる。<alpha-value> を差し込める形で渡すこと。
        ink: 'rgb(var(--c-ink-navy-rgb) / <alpha-value>)',
        chart: 'rgb(var(--c-chart-teal-rgb) / <alpha-value>)',
        stone: 'rgb(var(--c-stone-white-rgb) / <alpha-value>)',
        brass: 'rgb(var(--c-brass-gold-rgb) / <alpha-value>)',
        brick: 'rgb(var(--c-brick-coral-rgb) / <alpha-value>)',
        amber: 'rgb(var(--c-amber-rgb) / <alpha-value>)',
        'text-ink': 'rgb(var(--c-text-ink-rgb) / <alpha-value>)',
        'text-porcelain': 'rgb(var(--c-text-porcelain-rgb) / <alpha-value>)',
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
