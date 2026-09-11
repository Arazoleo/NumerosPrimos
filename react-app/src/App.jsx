import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import RouteLoading from './components/RouteLoading'
import PrimeverseExpeditionInvite from './features/primeverse/games/primeverse-online/party/PrimeverseExpeditionInvite'
import LandingPage from './pages/LandingPage'

const PrimeversePage = lazy(() => import('./features/primeverse/hub/PrimeversePage'))
const PrimeHunterPage = lazy(() => import('./features/primeverse/games/prime-hunter/PrimeHunterPage'))
const FactorForgePage = lazy(() => import('./features/primeverse/games/factor-forge/FactorForgePage'))
const ModularOrbitPage = lazy(() => import('./features/primeverse/games/modular-orbit/ModularOrbitPage'))
const CryptoEscapePage = lazy(() => import('./features/primeverse/games/crypto-escape/CryptoEscapePage'))
const PrimeDefensePage = lazy(() => import('./features/primeverse/games/prime-defense/PrimeDefensePage'))
const RsaVaultPage = lazy(() => import('./features/primeverse/games/rsa-vault/RsaVaultPage'))
const DiffieHellmanPage = lazy(() => import('./features/primeverse/games/diffie-hellman/DiffieHellmanPage'))
const UlamGalaxyPage = lazy(() => import('./features/primeverse/games/ulam-galaxy/UlamGalaxyPage'))
const PrimeboundPage = lazy(() => import('./features/primeverse/games/primebound/PrimeboundPage'))
const SkylineRunnerPage = lazy(() => import('./features/primeverse/games/skyline-runner/SkylineRunnerPage'))
const PrimeverseOnlinePage = lazy(() => import('./features/primeverse/games/primeverse-online/PrimeverseOnlinePage'))
const UlamRiftPage = lazy(() => import('./features/primeverse/games/ulam-rift/UlamRiftPage'))
const EuclidSiegePage = lazy(() => import('./features/primeverse/games/euclid-siege/EuclidSiegePage'))
const SieveCatacombsPage = lazy(() => import('./features/primeverse/games/sieve-catacombs/SieveCatacombsPage'))
const Nucleus257Page = lazy(() => import('./features/primeverse/games/nucleus-257/Nucleus257Page'))

export default function App() {
  return (
    <>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/jogos" element={<PrimeversePage />} />
        <Route path="/jogos/prime-hunter" element={<PrimeHunterPage />} />
        <Route path="/jogos/factor-forge" element={<FactorForgePage />} />
        <Route path="/jogos/modular-orbit" element={<ModularOrbitPage />} />
        <Route path="/jogos/crypto-escape" element={<CryptoEscapePage />} />
        <Route path="/jogos/prime-defense" element={<PrimeDefensePage />} />
        <Route path="/jogos/rsa-vault" element={<RsaVaultPage />} />
        <Route path="/jogos/diffie-hellman" element={<DiffieHellmanPage />} />
        <Route path="/jogos/ulam-galaxy" element={<UlamGalaxyPage />} />
        <Route path="/jogos/primebound" element={<PrimeboundPage />} />
        <Route path="/jogos/skyline-runner" element={<SkylineRunnerPage />} />
        <Route path="/jogos/primeverse-online" element={<PrimeverseOnlinePage />} />
        <Route path="/jogos/fenda-de-ulam" element={<UlamRiftPage />} />
        <Route path="/jogos/cerco-de-euclides" element={<EuclidSiegePage />} />
        <Route path="/jogos/cripta-do-crivo" element={<SieveCatacombsPage />} />
        <Route path="/jogos/nucleo-257" element={<Nucleus257Page />} />
        <Route path="/jogos/ulam-rift" element={<Navigate to="/jogos/fenda-de-ulam" replace />} />
        <Route path="/jogos/euclid-siege" element={<Navigate to="/jogos/cerco-de-euclides" replace />} />
        <Route path="/jogos/sieve-catacombs" element={<Navigate to="/jogos/cripta-do-crivo" replace />} />
        <Route path="/jogos/crypto-escape-room" element={<Navigate to="/jogos/crypto-escape" replace />} />
        <Route path="/jogos/*" element={<Navigate to="/jogos" replace />} />
        <Route path="*" element={<Navigate to="/jogos" replace />} />
        </Routes>
      </Suspense>
      <PrimeverseExpeditionInvite />
    </>
  )
}
