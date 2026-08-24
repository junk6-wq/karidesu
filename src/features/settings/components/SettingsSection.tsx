import type { ReactNode } from 'react'

/**
 * 設定画面の各セクションの外枠。
 * 「何の設定か」が一目で分かるよう、見出しの下に必ず短い説明を添える。
 */
export function SettingsSection({
  eyebrow,
  title,
  description,
  trailing,
  children,
  tone = 'light',
}: {
  eyebrow: string
  title: string
  description?: string
  trailing?: ReactNode
  children: ReactNode
  tone?: 'light' | 'dark'
}) {
  return (
    <section className="mt-11 first:mt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className={`label-caps ${tone === 'dark' ? 'text-text-porcelain/55' : 'text-text-ink/65'}`}
          >
            {eyebrow}
          </p>
          <h2 className="font-display text-[22px] mt-1">{title}</h2>
          {description && (
            <p
              className={`mt-1.5 text-[13px] leading-relaxed ${
                tone === 'dark' ? 'text-text-porcelain/55' : 'text-text-ink/65'
              }`}
            >
              {description}
            </p>
          )}
        </div>
        {trailing}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  )
}
