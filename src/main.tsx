import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { ptBR } from '@clerk/localizations'
import './index.css'
import App from './App'

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkKey ? (
      <ClerkProvider publishableKey={clerkKey} localization={ptBR} afterSignOutUrl="/login">
        <App />
      </ClerkProvider>
    ) : (
      <main className="grid min-h-screen place-items-center bg-gray-50 px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h1 className="text-lg font-bold text-amber-900">Clerk não configurado</h1>
          <p className="mt-2 text-sm text-amber-700">
            Defina <code className="font-mono">VITE_CLERK_PUBLISHABLE_KEY</code> no arquivo <code className="font-mono">.env</code>.
          </p>
        </div>
      </main>
    )}
  </StrictMode>,
)
