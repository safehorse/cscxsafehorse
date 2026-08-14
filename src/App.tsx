import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { Toaster } from 'sonner'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login/*" element={
          <>
            <SignedIn><Navigate to="/" replace /></SignedIn>
            <SignedOut><LoginPage /></SignedOut>
          </>
        } />
        <Route path="/*" element={
          <>
            <SignedIn><DashboardPage /></SignedIn>
            <SignedOut><Navigate to="/login" replace /></SignedOut>
          </>
        } />
      </Routes>
      <Toaster position="bottom-right" richColors />
    </BrowserRouter>
  )
}
