import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface SceneBoundaryProps { children: ReactNode }
interface SceneBoundaryState { failed: boolean }

export class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { failed: false }

  static getDerivedStateFromError(): SceneBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Primeverse WebGL scene failed', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <WebGLFallback />
  }
}

export function WebGLFallback() {
  return (
    <div className="pv-webgl-fallback" role="alert">
      <span className="pv-kicker">Modo compatibilidade</span>
      <h2>O universo 3D não pôde ser iniciado.</h2>
      <p>Você ainda pode abrir os jogos pelos acessos abaixo ou tentar ativar a aceleração gráfica do navegador.</p>
      <div>
        <Link to="/jogos/prime-hunter">Prime Hunter</Link>
        <Link to="/jogos/factor-forge">Factor Forge</Link>
        <Link to="/jogos/modular-orbit">Modular Orbit</Link>
        <Link to="/jogos/prime-defense">Prime Defense</Link>
        <Link to="/jogos/rsa-vault">RSA Vault</Link>
        <Link to="/jogos/diffie-hellman">Diffie–Hellman</Link>
        <Link to="/jogos/ulam-galaxy">Ulam Galaxy</Link>
        <Link to="/jogos/crypto-escape">Crypto Liminal</Link>
        <Link to="/jogos/skyline-runner">Prime Runner</Link>
        <Link to="/jogos/nucleo-257">Núcleo 257</Link>
        <Link to="/jogos/primeverse-online">Primeverse Online</Link>
      </div>
    </div>
  )
}
