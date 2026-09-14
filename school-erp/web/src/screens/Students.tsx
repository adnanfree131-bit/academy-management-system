import { useEffect, useState } from 'react'
import { api, fmtMoney } from '../api.js'

export function StudentsScreen() {
  const [students, setStudents] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [err, setErr] = useState('')

  const load = () => api<any[]>('GET', '/api/students').then(setStudents).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (selected) api('GET', `/api/students/${selected}`).then(setDetail).catch((e) => setErr(e.message))
    else setDetail(null)
  }, [selected])

  const filtered = students.filter((s) => (s.legal_name ?? '').toLowerCase().includes(q.toLowerCase()) || (s.person_no ?? '').includes(q))

  return (
    <>
      <h1>Students</h1>
      <p className="sub">Current identity, active enrollment, and section. Click a row for the 360 view.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="Search name or roll no…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {err && <p className="error">{err}</p>}
      <table>
        <thead>
          <tr><th>Roll</th><th>Name</th><th>Grade</th><th>Section</th><th>Enrolled</th><th>Status</th></tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id} onClick={() => setSelected(s.id)} style={{ cursor: 'pointer' }}>
              <td className="mono">{s.person_no}</td>
              <td>{s.legal_name}</td>
              <td>{s.grade ?? '—'}</td>
              <td>{s.section ?? '—'}</td>
              <td className="mono">{s.entry_date?.slice(0, 10) ?? '—'}</td>
              <td>{s.exit_date ? <span className="badge bad">{s.exit_type}</span> : <span className="badge ok">Active</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {detail && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{detail.identity?.legal_name} <span className="mono">{detail.identity?.person_no}</span></h2>
            <button className="ghost" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div className="kpis" style={{ marginTop: 12 }}>
            <div className="kpi"><div className="label">Billed</div><div className="value">{fmtMoney(detail.balance?.billed ?? 0)}</div></div>
            <div className="kpi"><div className="label">Collected</div><div className="value">{fmtMoney(detail.balance?.allocated ?? 0)}</div></div>
            <div className="kpi"><div className="label">Outstanding</div><div className="value">{fmtMoney(detail.balance?.balance ?? 0)}</div></div>
            <div className="kpi"><div className="label">Attendance (90d)</div><div className="value">{detail.attendance?.percent ?? 0}%</div></div>
          </div>
          <h2>Guardians</h2>
          <table>
            <thead><tr><th>Name</th><th>Relation</th><th>View</th><th>Pay</th><th>Pickup</th><th>Fin. resp.</th></tr></thead>
            <tbody>
              {(detail.guardians ?? []).map((g: any, i: number) => (
                <tr key={i}>
                  <td>{g.legal_name}</td><td>{g.relation_label ?? '—'}</td>
                  <td>{g.can_view ? '✓' : ''}</td><td>{g.can_pay ? '✓' : ''}</td>
                  <td>{g.can_pickup ? '✓' : ''}</td><td>{g.is_financially_responsible ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
