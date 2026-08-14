import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { Toaster } from 'sonner'
import { AgendaPage } from './pages/AgendaPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { WhatsappPage } from './pages/WhatsappPage'

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
        <Route path="/agenda" element={
          <>
            <SignedIn><AgendaPage /></SignedIn>
            <SignedOut><Navigate to="/login" replace /></SignedOut>
          </>
        } />
        <Route path="/chamados" element={
          <>
            <SignedIn><DashboardPage mode="chamados" /></SignedIn>
            <SignedOut><Navigate to="/login" replace /></SignedOut>
          </>
        } />
        <Route path="/whatsapp" element={
          <>
            <SignedIn><WhatsappPage /></SignedIn>
            <SignedOut><Navigate to="/login" replace /></SignedOut>
          </>
        } />
        <Route path="/usuarios" element={
          <>
            <SignedIn><UsuariosPage /></SignedIn>
            <SignedOut><Navigate to="/login" replace /></SignedOut>
          </>
        } />
        <Route path="/*" element={
          <>
            <SignedIn><DashboardPage mode="dashboard" /></SignedIn>
            <SignedOut><Navigate to="/login" replace /></SignedOut>
          </>
        } />
      </Routes>
      <Toaster position="bottom-right" richColors />
    </BrowserRouter>
  )
}
