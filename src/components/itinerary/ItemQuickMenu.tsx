import { BottomSheet } from '@/components/common/Sheet'

/**
 * 予定 1 件の「⋮」クイックメニュー。
 * ドラッグ&ドロップに依存せず、スマホの片手操作でも並べ替え・複製・削除ができるようにする。
 * 時間変更・DAY変更は既存の SpotDetailSheet（日を移すチップ・時刻フィールドを持つ）に委ねる。
 */
export function ItemQuickMenu({
  open,
  onClose,
  spotName,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onOpenDetail,
}: {
  open: boolean
  onClose: () => void
  spotName: string
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
  onDelete: () => void
  onOpenDetail: () => void
}) {
  function run(action: () => void) {
    action()
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={spotName}>
      <div className="space-y-1.5">
        <MenuRow label="上へ移動" onClick={() => run(onMoveUp)} disabled={isFirst} />
        <MenuRow label="下へ移動" onClick={() => run(onMoveDown)} disabled={isLast} />
        <MenuRow label="時間・DAYを編集" onClick={() => run(onOpenDetail)} />
        <MenuRow label="複製する" onClick={() => run(onDuplicate)} />
        <MenuRow label="削除する" tone="danger" onClick={() => run(onDelete)} />
      </div>
    </BottomSheet>
  )
}

function MenuRow({
  label,
  onClick,
  disabled = false,
  tone = 'default',
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`tap flex w-full items-center rounded-xl px-4 text-[15px] transition duration-200 ease-passage disabled:opacity-35 ${
        tone === 'danger' ? 'text-brick hover:bg-brick/10' : 'text-text-ink hover:bg-black/[0.04]'
      }`}
    >
      {label}
    </button>
  )
}
