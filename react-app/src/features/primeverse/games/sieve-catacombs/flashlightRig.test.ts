import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import {
  FLASHLIGHT_TARGET_DISTANCE,
  aimFlashlightFromCamera,
  flashlightPowerMultiplier,
} from './flashlightRig'

describe('Cripta do Crivo flashlight rig', () => {
  it.each([
    { pitch: 0, yaw: 0 },
    { pitch: 0.92, yaw: -1.25 },
    { pitch: -1.04, yaw: 2.14 },
  ])('keeps the beam aligned with the camera at pitch $pitch and yaw $yaw', ({ pitch, yaw }) => {
    const camera = new THREE.PerspectiveCamera(74, 16 / 9, 0.06, 125)
    const light = new THREE.SpotLight()
    const target = new THREE.Object3D()
    const forward = new THREE.Vector3()
    const lightPosition = new THREE.Vector3()
    const expectedForward = new THREE.Vector3()

    camera.position.set(7, 1.66, -13)
    camera.rotation.set(pitch, yaw, 0, 'YXZ')
    camera.getWorldDirection(expectedForward)

    aimFlashlightFromCamera(camera, light, target, forward, lightPosition)

    const beamDirection = target.position.clone().sub(light.position).normalize()
    expect(forward.dot(expectedForward)).toBeCloseTo(1, 6)
    expect(beamDirection.dot(expectedForward)).toBeGreaterThan(0.9999)
    expect(target.position.distanceTo(camera.position)).toBeCloseTo(FLASHLIGHT_TARGET_DISTANCE, 6)
  })

  it('only adds a restrained pulse at critically low battery', () => {
    expect(flashlightPowerMultiplier(100, 3, false)).toBe(1)
    expect(flashlightPowerMultiplier(5, 3, true)).toBe(1)

    for (let time = 0; time <= 5; time += 0.05) {
      expect(flashlightPowerMultiplier(5, time, false)).toBeGreaterThanOrEqual(0.7)
      expect(flashlightPowerMultiplier(5, time, false)).toBeLessThanOrEqual(0.98)
    }
  })
})
