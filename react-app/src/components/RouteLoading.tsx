import './RouteLoading.css'

export default function RouteLoading() {
  return (
    <main className="route-loading" aria-live="polite" aria-busy="true">
      <div className="route-loading__orbit" aria-hidden="true">
        <span>2</span><span>3</span><span>5</span>
      </div>
      <p>Calculando coordenadas…</p>
    </main>
  )
}
