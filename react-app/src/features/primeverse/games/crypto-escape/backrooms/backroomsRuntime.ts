import { create } from 'zustand'

import { getBackroomsSector } from './backroomsLayout'

export type BackroomsThreatLevel = 'quiet' | 'listening' | 'chase' | 'stunned'

export interface BackroomsPlayerPose {
  readonly x: number
  readonly z: number
  readonly yaw: number
}

interface BackroomsRuntimeState {
  player: BackroomsPlayerPose
  sectorName: string
  threat: BackroomsThreatLevel
  threatDistance: number | null
  composure: number
  hitSerial: number
  captureSerial: number
  startRun: (player: BackroomsPlayerPose) => void
  reportPlayer: (player: BackroomsPlayerPose) => void
  reportThreat: (threat: BackroomsThreatLevel, distance: number | null) => void
  takeHit: (damage: number) => boolean
  reset: () => void
}

const DEFAULT_PLAYER: BackroomsPlayerPose = { x: 0, z: 0, yaw: 0 }

function safeDistance(distance: number | null): number | null {
  return distance !== null && Number.isFinite(distance)
    ? Math.max(0, distance)
    : null
}

function sectorAt(player: BackroomsPlayerPose): string {
  return getBackroomsSector(player)?.name ?? 'Zona sem planta'
}

export const useBackroomsRuntime = create<BackroomsRuntimeState>((set, get) => ({
  player: DEFAULT_PLAYER,
  sectorName: 'Recepção Ausente',
  threat: 'quiet',
  threatDistance: null,
  composure: 100,
  hitSerial: 0,
  captureSerial: 0,

  startRun: (player) => set({
    player,
    sectorName: sectorAt(player),
    threat: 'quiet',
    threatDistance: null,
    composure: 100,
    hitSerial: 0,
    captureSerial: 0,
  }),

  reportPlayer: (player) => {
    const previous = get()
    const sectorName = sectorAt(player)
    if (
      Math.abs(previous.player.x - player.x) < 0.08 &&
      Math.abs(previous.player.z - player.z) < 0.08 &&
      Math.abs(previous.player.yaw - player.yaw) < 0.025 &&
      sectorName === previous.sectorName
    ) return
    set({ player, sectorName })
  },

  reportThreat: (threat, rawDistance) => {
    const distance = safeDistance(rawDistance)
    const previous = get()
    if (
      previous.threat === threat &&
      (previous.threatDistance === distance || (
        previous.threatDistance !== null &&
        distance !== null &&
        Math.abs(previous.threatDistance - distance) < 0.35
      ))
    ) return
    set({ threat, threatDistance: distance })
  },

  takeHit: (rawDamage) => {
    const damage = Number.isFinite(rawDamage) ? Math.max(0, rawDamage) : 0
    const state = get()
    const remaining = Math.max(0, state.composure - damage)
    const captured = remaining <= 0
    set({
      composure: captured ? 100 : remaining,
      hitSerial: state.hitSerial + 1,
      captureSerial: captured ? state.captureSerial + 1 : state.captureSerial,
      threat: captured ? 'quiet' : state.threat,
      threatDistance: captured ? null : state.threatDistance,
    })
    return captured
  },

  reset: () => set({
    player: DEFAULT_PLAYER,
    sectorName: 'Recepção Ausente',
    threat: 'quiet',
    threatDistance: null,
    composure: 100,
    hitSerial: 0,
    captureSerial: 0,
  }),
}))
