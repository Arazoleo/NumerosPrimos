import * as THREE from 'three'

export const FLASHLIGHT_TARGET_DISTANCE = 28

const FLASHLIGHT_LOCAL_OFFSET = new THREE.Vector3(0.16, -0.11, -0.08)

export function aimFlashlightFromCamera(
  camera: THREE.Camera,
  light: THREE.SpotLight,
  target: THREE.Object3D,
  forward: THREE.Vector3,
  lightPosition: THREE.Vector3,
): THREE.Vector3 {
  camera.updateMatrixWorld()
  camera.getWorldDirection(forward).normalize()

  target.position.copy(camera.position).addScaledVector(forward, FLASHLIGHT_TARGET_DISTANCE)
  target.updateMatrixWorld(true)

  lightPosition.copy(FLASHLIGHT_LOCAL_OFFSET).applyQuaternion(camera.quaternion).add(camera.position)
  light.position.copy(lightPosition)
  light.target = target
  return forward
}

export function flashlightPowerMultiplier(
  battery: number,
  elapsedSeconds: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion || battery >= 14) return 1
  const pulse = 0.84
    + Math.sin(elapsedSeconds * 13.4) * 0.08
    + Math.sin(elapsedSeconds * 27.7) * 0.04
  return THREE.MathUtils.clamp(pulse, 0.7, 0.98)
}
