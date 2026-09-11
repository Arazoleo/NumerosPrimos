import { Component, type ErrorInfo, type ReactNode } from 'react'

interface FactorForgeBoundaryProps {
  children: ReactNode
}

interface FactorForgeBoundaryState {
  failed: boolean
}

export class FactorForgeBoundary extends Component<
  FactorForgeBoundaryProps,
  FactorForgeBoundaryState
> {
  state: FactorForgeBoundaryState = { failed: false }

  static getDerivedStateFromError(): FactorForgeBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Factor Forge 3D scene failed', error, info)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children

    return (
      <div className="factor-forge__webgl-fallback" role="alert">
        <strong>Modo de compatibilidade</strong>
        <span>A cena 3D foi desativada, mas o console de fatoração continua funcional.</span>
      </div>
    )
  }
}

