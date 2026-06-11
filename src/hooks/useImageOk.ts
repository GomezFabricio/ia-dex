import { useState } from 'react'

// ---------------------------------------------------------------------------
// useImageOk — decide whether an image is good enough to show, or whether to
// fall back to a placeholder. Vector images (SVG) scale infinitely, so they
// always pass. Raster images smaller than `minSize` on their shorter side
// would upscale into a blurry mess in a banner — better to hide them.
//
// Usage:
//   const { show, imgProps } = useImageOk(url, 240)
//   {show ? <img src={url} {...imgProps} /> : <Placeholder />}
// ---------------------------------------------------------------------------

const isVector = (url: string) => /\.svg(\?|#|$)/i.test(url)

export function useImageOk(url: string | null | undefined, minSize = 200) {
  const [ok, setOk] = useState(true)
  const [trackedUrl, setTrackedUrl] = useState(url)

  // Reset the decision when the source changes (idiomatic "adjust state on
  // prop change" — done during render, not in an effect).
  if (url !== trackedUrl) {
    setTrackedUrl(url)
    setOk(true)
  }

  if (!url || !ok) return { show: false as const, imgProps: {} }

  return {
    show: true as const,
    imgProps: {
      onError: () => setOk(false),
      onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => {
        if (isVector(url)) return
        const img = e.currentTarget
        if (Math.min(img.naturalWidth, img.naturalHeight) < minSize) setOk(false)
      },
    },
  }
}
