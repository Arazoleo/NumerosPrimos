interface TutorialViewport {
  readonly width: number
  readonly height: number
}

interface TutorialTarget {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

interface TutorialPanelSize {
  readonly width: number
  readonly height: number
}

export interface RsaTutorialPanelLayout {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly maxHeight: number
}

const MARGIN = 16
const GAP = 16
const MIN_SIDE_WIDTH = 280

export function getRsaTutorialPanelLayout(
  viewport: TutorialViewport,
  target: TutorialTarget,
  panel: TutorialPanelSize,
): RsaTutorialPanelLayout {
  const marginX = Math.min(MARGIN, viewport.width / 2)
  const marginY = Math.min(MARGIN, viewport.height / 2)
  const width = Math.max(0, viewport.width - marginX * 2)
  const height = Math.max(0, viewport.height - marginY * 2)
  const leftSpace = Math.max(0, Math.min(width, target.left - GAP - marginX))
  const rightSpace = Math.max(0, Math.min(width, viewport.width - marginX - target.right - GAP))

  if (Math.max(leftSpace, rightSpace) >= MIN_SIDE_WIDTH) {
    const useRight = rightSpace >= leftSpace
    const sideSpace = useRight ? rightSpace : leftSpace
    const panelWidth = Math.min(panel.width, sideSpace)
    return {
      left: useRight ? viewport.width - marginX - rightSpace : marginX + leftSpace - panelWidth,
      top: marginY,
      width: panelWidth,
      maxHeight: height,
    }
  }

  const aboveSpace = Math.max(0, Math.min(height, target.top - GAP - marginY))
  const belowSpace = Math.max(0, Math.min(height, viewport.height - marginY - target.bottom - GAP))
  if (Math.max(aboveSpace, belowSpace) > 0) {
    const useBelow = belowSpace > aboveSpace
    const maxHeight = useBelow ? belowSpace : aboveSpace
    return {
      left: marginX,
      top: useBelow ? viewport.height - marginY - belowSpace : marginY,
      width,
      maxHeight,
    }
  }

  // A target filling the viewport leaves no non-overlapping position.
  return { left: marginX, top: marginY, width, maxHeight: height }
}
