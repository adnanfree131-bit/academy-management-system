import { useEffect, useState } from 'react'
import { api, getToken, setToken, clearToken, today } from './api.js'
import { OnboardScreen } from './screens/Onboard.js'
import { StudentsScreen } from './screens/Students.js'
import { AdmitScreen } from './screens/Admit.js'
import { AttendanceScreen } from './screens/Attendance.js'
import { FeeDeskScreen } from './screens/FeeDesk.js'
import { RolloverScreen } from './screens/Rollover.js'
import { PortalScreen } from './screens/Portal.js'

type Session = { userId: string; email: string; tenantId: string; role: string }

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [screen, setScreen] = useState('dashboard')

  useEffect(() => {
    if (getToken()) {
      api<Session>('GET', '/api/me')
        .then(setSession)
        .catch(() => clearToken())
    }
  }, [])

  if (!session) {
    return <Login onSignIn={(s) => { setToken(s.token); setSession(s.session); setScreen(s.session.role === 'GUARDIAN' ? 'portal' : 'dashboard') }} />
  }

  const signOut = () => { clearToken(); setSession(null) }
  const isAdmin = session.role === 'ADMIN' || session.role === 'STAFF'

  const nav: Array<{ id: string; label: string }> = isAdmin
    ? [
        { id: 'dashboard', label: 'Overview' },
        { id: 'students', label: 'Students' },
        { id: 'admit', label: 'Admit Student' },
        { id: 'attendance', label: 'Attendance' },
        { id: 'fees', label: 'Fee Desk' },
        { id: 'rollover', label: 'Year Rollover' },
        { id: 'onboard', label: 'New Academy' },
      ]
    : [{ id: 'portal', label: 'My Children' }]

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">School ERP</div>
        {nav.map((n) => (
          <a key={n.id} href="#" className={screen === n.id ? 'active' : ''} onClick={(e) => { e.preventDefault(); setScreen(n.id) }}>
            {n.label}
          </a>
        ))}
        <div className="role-pill">
          {session.email} · {session.role}
          <button className="link" onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        {screen === 'dashboard' && <Dashboard session={session} go={setScreen} />}
        {screen === 'students' && isAdmin && <StudentsScreen />}
        {screen === 'admit' && isAdmin && <AdmitScreen />}
        {screen === 'attendance' && isAdmin && <AttendanceScreen />}
        {screen === 'fees' && isAdmin && <FeeDeskScreen />}
        {screen === 'rollover' && isAdmin && <RolloverScreen />}
        {screen === 'onboard' && <OnboardScreen onDone={() => setScreen('dashboard')} />}
        {screen === 'portal' && <PortalScreen session={session} />}
      </main>
    </div>
  )
}

function Login({ onSignIn }: { onSignIn: (r: { token: string; session: Session }) => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const requestOtp = async () => {
    setBusy(true); setErr('')
    try {
      const r = await api<{ devCode?: string }>('POST', '/api/auth/otp', { email })
      setDevCode(r.devCode ?? null)
      setStep('code')
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  const verify = async () => {
    setBusy(true); setErr('')
    try {
      const r = await api<any>('POST', '/api/auth/verify', { email, code })
      if (r.status === 'ok') onSignIn({ token: r.token, session: r.session })
      else setErr(r.status === 'no_membership' ? 'No academy membership for this email.' : 'Invalid or expired code.')
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="login-wrap">
      <div className="card">
        <h1>School ERP</h1>
        <p className="sub">Passwordless sign-in</p>
        {step === 'email' ? (
          <>
            <div className="row">
              <input style={{ flex: 1 }} type="email" placeholder="you@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="accent" onClick={requestOtp} disabled={busy || !email}>Get code</button>
            </div>
            <p className="sub" style={{ marginTop: 12 }}>No account yet? Create an academy from the New Academy screen after sign-in — or ask your admin to admit you.</p>
          </>
        ) : (
          <>
            <div className="row">
              <input style={{ flex: 1 }} inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="accent" onClick={verify} disabled={busy || code.length !== 6}>Sign in</button>
            </div>
            {devCode && <p className="notice">Dev mode: your code is <b className="mono">{devCode}</b> (email delivery not configured).</p>}
          </>
        )}
        {err && <p className="error">{err}</p>}
      </div>
    </div>
  )
}

function Dashboard({ session, go }: { session: Session; go: (s: string) => void }) {
  const [students, setStudents] = useState<any[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    api<any[]>('GET', '/api/students').then(setStudents).catch((e) => setErr(e.message))
  }, [])

  const active = students.filter((s) => !s.exit_date).length
  return (
    <>
      <h1>Overview</h1>
      <p className="sub">{today()} · role {session.role}</p>
      <div className="kpis">
        <div className="kpi"><div className="label">Active students</div><div className="value">{active}</div></div>
        <div className="kpi"><div className="label">Total enrolled (all time)</div><div className="value">{students.length}</div></div>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="card">
        <h2>Quick actions</h2>
        <div className="row">
          <button className="accent" onClick={() => go('admit')}>+ Admit student</button>
          <button className="ghost" onClick={() => go('attendance')}>Mark attendance</button>
          <button className="ghost" onClick={() => go('fees')}>Collect fee</button>
        </div>
      </div>
    </>
  )
}
