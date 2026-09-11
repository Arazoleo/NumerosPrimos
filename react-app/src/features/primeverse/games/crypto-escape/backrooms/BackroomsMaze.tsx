import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  BACKROOMS_CELL_SIZE,
  BACKROOMS_CEILING_Y,
  BACKROOMS_FLOOR_Y,
  BACKROOMS_OPEN_CELLS,
  BACKROOMS_SECTORS,
  BACKROOMS_WALL_CELLS,
  BACKROOMS_WALL_EDGES,
  DEFAULT_BACKROOMS_ORIGIN,
  type BackroomsOrigin,
} from './backroomsLayout'

export interface BackroomsMazeProps {
  readonly origin?: BackroomsOrigin
  readonly shadows?: boolean
  readonly detailed?: boolean
}

function createCarpetNoise(): THREE.DataTexture {
  const size = 32
  const data = new Uint8Array(size * size)
  for (let index = 0; index < data.length; index += 1) {
    const value = (index * 73 + Math.floor(index / size) * 131 + 41) % 47
    data[index] = 92 + value * 3
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)
  texture.needsUpdate = true
  return texture
}

function LiminalArchitecture({ detailed }: { readonly detailed: boolean }): JSX.Element {
  return (
    <group>
      {detailed && ([
        [18.7, -29.4, 0], [26.3, -29.4, 0], [34, -29.4, 0],
        [18.7, -18, Math.PI / 2], [34, -18, Math.PI / 2],
      ] as const).map(([x, z, rotation], index) => (
        <group key={index} position={[x, -0.5, z]} rotation={[0, rotation, 0]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[3.15, 1.65, 0.14]} />
            <meshStandardMaterial color="#9d915b" roughness={0.83} />
          </mesh>
          <mesh position={[0, 1.34, 0]}>
            <boxGeometry args={[3.28, 0.08, 0.2]} />
            <meshBasicMaterial color="#ddd298" transparent opacity={0.38} />
          </mesh>
        </group>
      ))}

      {detailed && [-36.1, -28.5, -20.9].map((x, index) => (
        <group key={x} position={[x, 0, 28.5]}>
          <mesh position={[0, -0.45, 0]}>
            <boxGeometry args={[1.25, 3.2, 3.15]} />
            <meshStandardMaterial color="#675137" metalness={0.08} roughness={0.82} />
          </mesh>
          {[0.15, -0.55, -1.25].map((y) => (
            <mesh key={y} position={[0.64, y, 0]}>
              <boxGeometry args={[0.04, 0.05, 2.65]} />
              <meshBasicMaterial color={index === 1 ? '#d1a65e' : '#aa8750'} transparent opacity={0.52} />
            </mesh>
          ))}
        </group>
      ))}

      {[-31, -24, -17].map((x) => (
        <group key={x} position={[x, 2.65, 34.1]} rotation={[0, 0, Math.PI / 2]}>
          <mesh><cylinderGeometry args={[0.09, 0.09, 8, 10]} /><meshStandardMaterial color="#8c7249" metalness={0.42} roughness={0.48} /></mesh>
          <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[0.025, 0.025, 8, 8]} /><meshBasicMaterial color="#403523" /></mesh>
        </group>
      ))}

      <mesh position={[0, BACKROOMS_FLOOR_Y + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.1, 6.3, 48]} />
        <meshStandardMaterial color="#48533a" emissive="#697448" emissiveIntensity={0.08} transparent opacity={0.58} roughness={0.98} />
      </mesh>
    </group>
  )
}

/**
 * Instanced shell for the generated maze. The instance colors encode its five
 * sectors while the low-frequency data texture creates asset-free carpet nap.
 */
export function BackroomsMaze({
  origin = DEFAULT_BACKROOMS_ORIGIN,
  shadows = true,
  detailed = true,
}: BackroomsMazeProps): JSX.Element {
  const floors = useRef<THREE.InstancedMesh>(null)
  const ceilings = useRef<THREE.InstancedMesh>(null)
  const walls = useRef<THREE.InstancedMesh>(null)
  const baseboards = useRef<THREE.InstancedMesh>(null)
  const carpetNoise = useMemo(createCarpetNoise, [])

  useLayoutEffect(() => {
    const transform = new THREE.Object3D()
    const color = new THREE.Color()
    for (const [index, cell] of BACKROOMS_OPEN_CELLS.entries()) {
      transform.position.set(cell.x, BACKROOMS_FLOOR_Y - 0.08, cell.z)
      transform.rotation.set(0, 0, 0)
      transform.scale.set(1, 1, 1)
      transform.updateMatrix()
      floors.current?.setMatrixAt(index, transform.matrix)
      color.set(BACKROOMS_SECTORS[cell.sectorId].carpetColor)
      floors.current?.setColorAt(index, color)

      transform.position.y = BACKROOMS_CEILING_Y + 0.07
      transform.updateMatrix()
      ceilings.current?.setMatrixAt(index, transform.matrix)
      color.set(BACKROOMS_SECTORS[cell.sectorId].wallColor).multiplyScalar(0.72)
      ceilings.current?.setColorAt(index, color)
    }
    for (const [index, cell] of BACKROOMS_WALL_CELLS.entries()) {
      transform.position.set(cell.x, (BACKROOMS_FLOOR_Y + BACKROOMS_CEILING_Y) / 2, cell.z)
      transform.rotation.set(0, 0, 0)
      transform.updateMatrix()
      walls.current?.setMatrixAt(index, transform.matrix)
      color.set(BACKROOMS_SECTORS[cell.sectorId].wallColor)
      walls.current?.setColorAt(index, color)
    }
    for (const [index, edge] of BACKROOMS_WALL_EDGES.entries()) {
      transform.position.set(edge.x, BACKROOMS_FLOOR_Y + 0.09, edge.z)
      transform.rotation.set(0, edge.rotation, 0)
      transform.updateMatrix()
      baseboards.current?.setMatrixAt(index, transform.matrix)
      color.set(BACKROOMS_SECTORS[edge.sectorId].wallColor).multiplyScalar(0.48)
      baseboards.current?.setColorAt(index, color)
    }
    for (const instance of [floors.current, ceilings.current, walls.current, baseboards.current]) {
      if (!instance) continue
      instance.instanceMatrix.needsUpdate = true
      if (instance.instanceColor) instance.instanceColor.needsUpdate = true
    }
    return () => carpetNoise.dispose()
  }, [baseboards, carpetNoise, ceilings, floors, walls])

  return (
    <group position={origin as [number, number, number]}>
      <instancedMesh
        ref={floors}
        args={[undefined, undefined, BACKROOMS_OPEN_CELLS.length]}
        receiveShadow={shadows}
      >
        <boxGeometry args={[BACKROOMS_CELL_SIZE - 0.035, 0.16, BACKROOMS_CELL_SIZE - 0.035]} />
        <meshStandardMaterial color="#ffffff" vertexColors bumpMap={carpetNoise} bumpScale={0.045} roughness={0.97} metalness={0} />
      </instancedMesh>

      <instancedMesh
        ref={ceilings}
        args={[undefined, undefined, BACKROOMS_OPEN_CELLS.length]}
      >
        <boxGeometry args={[BACKROOMS_CELL_SIZE - 0.025, 0.14, BACKROOMS_CELL_SIZE - 0.025]} />
        <meshStandardMaterial color="#ffffff" vertexColors roughness={0.86} metalness={0.02} />
      </instancedMesh>

      <instancedMesh
        ref={walls}
        args={[undefined, undefined, BACKROOMS_WALL_CELLS.length]}
        castShadow={shadows}
        receiveShadow={shadows}
      >
        <boxGeometry args={[BACKROOMS_CELL_SIZE, BACKROOMS_CEILING_Y - BACKROOMS_FLOOR_Y, BACKROOMS_CELL_SIZE]} />
        <meshStandardMaterial color="#ffffff" vertexColors roughness={0.89} metalness={0.01} />
      </instancedMesh>

      <instancedMesh
        ref={baseboards}
        args={[undefined, undefined, BACKROOMS_WALL_EDGES.length]}
      >
        <boxGeometry args={[BACKROOMS_CELL_SIZE, 0.18, 0.12]} />
        <meshStandardMaterial color="#ffffff" vertexColors roughness={0.68} metalness={0.08} />
      </instancedMesh>

      <LiminalArchitecture detailed={detailed} />
    </group>
  )
}

export default BackroomsMaze
