import { SignIn } from '@clerk/clerk-react'

const appearance = {
  variables: {
    colorPrimary: '#2563eb',
    colorText: '#0f172a',
    colorTextSecondary: '#64748b',
    colorBackground: '#ffffff',
    colorInputBackground: '#f8fafc',
    colorInputText: '#0f172a',
    colorDanger: '#dc2626',
    borderRadius: '1rem',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full',
    card: 'w-full rounded-[26px] border border-gray-200/90 bg-white p-3',
    header: 'px-2 pt-2',
    footer: 'px-2 pb-2',
    formButtonPrimary: 'rounded-xl bg-blue-600 py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors',
    formFieldInput: 'rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100',
  },
}

export function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <SignIn routing="hash" fallbackRedirectUrl="/" appearance={appearance} />
      </div>
    </main>
  )
}
