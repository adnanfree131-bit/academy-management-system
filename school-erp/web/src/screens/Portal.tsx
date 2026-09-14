import { useEffect, useState } from 'react'
import { api, fmtMoney } from '../api.js'
import type { Session } from '../App.js'

export function PortalScreen({ session }: { session: Session }) {
  const [children, setChildren] = useState<any[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api<any[]>('GET', '/api/portal/my-children').then(setChildren).catch((e) => setErr(e.message))
  }, [])

  useEffect(() => {
    if (!activeId) return setDetail(null)
    api('GET', `/api/portal/child/${activeId}`).then(setDetail).catch((e) => setErr(e.message))
  }, [activeId])

  const active = children.find((c) => c.id === activeId)

  return (
    <>
      <h1>My Children</h1>
      <p className="sub">{session.email} · read-only portal</p>
      {err && <p className="error">{err}</p>}
      <div className="row" style={{ marginBottom: 16 }}>
        {children.map((c) => (
          <button key={c.id} className={activeId === c.id ? 'accent' : 'ghost'} onClick={() => setActiveId(c.id)}>
            {c.legal_name} <span className="mono">{c.person_no}</span>
          </button>
        ))}
        {children.length === 0 && <span className="sub">No children linked to this account.</span>}
      </div>
      {detail && active && (
        <>
          <div className="kpis">
            <div className="kpi"><div className="label">Attendance (30d)</div><div className="value">{detail.attendance?.percent ?? 0}%</div></div>
            <div className="kpi"><div className="label">Fees due</div><div className="value">{fmtMoney(detail.balance?.balance ?? 0)}</div></div>
            <div className="kpi"><div className="label">Paid to date</div><div className="value">{fmtMoney(detail.balance?.allocated ?? 0)}</div></div>
          </div>
          <h2>Recent attendance</h2>
          <table>
            <thead><tr><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {(detail.recentAttendance ?? []).map((r: any, i: number) => (
                <tr key={i}>
                  <td className="mono">{String(r.day).slice(0, 10)}</td>
                  <td>
                    <span className={`badge ${r.category === 'PRESENT' ? 'ok' : r.category === 'LATE' ? 'warn' : 'bad'}`}>
                      {r.category}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}
