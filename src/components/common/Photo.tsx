import { useEffect, useState } from 'react'

/** 文字列から安定した色相を作り、写真が無い/読めないときの下地にする。 */
function hueOf(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}

/**
 * 写真表示。読み込み失敗・未設定時は海図トーンのグラデーションに落とす。
 * 写真主義のレイアウトを、画像が無くても崩さないための土台。
 */
export function Photo({
  src,
  alt,
  seed = alt,
  className = '',
  imgClassName = '',
  children,
}: {
  src?: string
  alt: string
  seed?: string
  className?: string
  imgClassName?: string
  children?: React.ReactNode
}) {
  const [failed, setFailed] = useState(false)
  // src が切り替わったら（写真カルーセルでの切り替えなど）、前の画像の失敗状態を引きずらない
  useEffect(() => setFailed(false), [src])
  const hue = hueOf(seed)
  const showImage = Boolean(src) && !failed

  return (
    <div
      className={`relative overflow-hidden bg-chart ${className}`}
      style={{
        // 通信が遅い/失敗した場面で画面が真っ黒に見えないよう、下地は暗くしすぎない
        backgroundImage: showImage
          ? undefined
          : `linear-gradient(150deg, hsl(${hue} 24% 38%), hsl(${(hue + 40) % 360} 28% 24%))`,
      }}
    >
      {showImage && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover ${imgClassName}`}
        />
      )}
      {!showImage && (
        <span className="label-caps absolute bottom-3 left-3 text-text-porcelain/55">
          NO IMAGE
        </span>
      )}
      {children}
    </div>
  )
}
