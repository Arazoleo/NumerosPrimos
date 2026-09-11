const FULL_TURN = Math.PI * 2

export function wrapCarouselIndex(index: number, itemCount: number) {
  if (!Number.isInteger(itemCount) || itemCount <= 0) return 0
  return ((index % itemCount) + itemCount) % itemCount
}

export function carouselStep(itemCount: number) {
  return itemCount > 0 ? FULL_TURN / itemCount : 0
}

export function nearestEquivalentAngle(target: number, current: number) {
  return current + Math.atan2(Math.sin(target - current), Math.cos(target - current))
}

export function pixelsPerCarouselStep(viewportWidth: number) {
  return Math.min(180, Math.max(88, viewportWidth * .18))
}

export function dragPixelsToAngle(deltaX: number, viewportWidth: number, itemCount: number) {
  return (deltaX / pixelsPerCarouselStep(viewportWidth)) * carouselStep(itemCount)
}

interface ResolveCarouselDragOptions {
  deltaX: number
  velocityX: number
  viewportWidth: number
  maxSteps?: number
}

export function resolveCarouselDrag({
  deltaX,
  velocityX,
  viewportWidth,
  maxSteps = 3,
}: ResolveCarouselDragOptions) {
  if (Math.abs(deltaX) < 8) return 0

  const projectedDelta = deltaX + velocityX * 130
  const rawSteps = -projectedDelta / pixelsPerCarouselStep(viewportWidth)
  const direction = Math.sign(rawSteps)
  if (direction === 0) return 0

  const magnitude = Math.min(maxSteps, Math.max(1, Math.round(Math.abs(rawSteps))))
  return direction * magnitude
}
