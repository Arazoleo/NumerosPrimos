export type EscapeMoveCommand = 'forward' | 'backward' | 'left' | 'right' | 'turn-left' | 'turn-right' | 'sprint'

interface LookDelta {
  x: number
  y: number
}

const pressed = new Set<EscapeMoveCommand>()
const lookDelta: LookDelta = { x: 0, y: 0 }

export function setEscapeMove(command: EscapeMoveCommand, active: boolean): void {
  if (active) pressed.add(command)
  else pressed.delete(command)
}

export function isEscapeMovePressed(command: EscapeMoveCommand): boolean {
  return pressed.has(command)
}

export function addEscapeLookDelta(x: number, y: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  lookDelta.x += x
  lookDelta.y += y
}

export function consumeEscapeLookDelta(): LookDelta {
  const snapshot = { ...lookDelta }
  lookDelta.x = 0
  lookDelta.y = 0
  return snapshot
}

export function resetEscapeInput(): void {
  pressed.clear()
  lookDelta.x = 0
  lookDelta.y = 0
}
