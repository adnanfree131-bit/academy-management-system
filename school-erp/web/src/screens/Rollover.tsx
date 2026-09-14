import { useEffect, useState } from 'react'
import { api } from '../api.js'

export function RolloverScreen() {
  const [students, setStudents] = useState<any[]>([])
  const [decisions, setDecisions] = useState<Record<string, { action: string; nextGradeId: string | null }>>({})
  const [summary, setSummary] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<any[]>('GET', '/api/students').then(setStudents).catch((e) => setErr(e.message))
  }, [])

  const set = (personId: string, action: string, nextGradeId: string | null) => {
    setDecisions((d) => ({ ...d, [personId]: { action, nextGradeId } }))
    api('POST', '/api/rollover/decision', { personId, action, nextGradeId }).catch((e) => setErr(e.message))
  }

  const execute = async () => {
    setBusy(true); setErr(''); setSummary(null)
    try {
      const years = await api<any[]>('GET', '/api/years')
      const from = years.find((y: any) => y.status === 'ACTIVE')
      const to = years.find((y: any) => y.status === 'PLANNING')
      if (!from || !to) throw new Error('Need one ACTIVE year and one PLANNING year (create the next year first).')
      const r = await api('POST', '/api/rollover/execute', {
        fromYearId: from.id, toYearId: to.id, toYearStartDate: to.start_date,
      })
      setSummary(r)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <>
      <h1>Year Rollover</h1>
      <p className="sub">Promotion is a decision, not an edit. The run creates next-year enrollments from these flags — never grade updates in place.</p>
      {err && <p className="error">{err}</p>}
      <table>
        <thead><tr><th>Roll</th><th>Name</th><th>Grade</th><th>Decision</th><th>Next grade</th></tr></thead>
        <tbody>
          {students.filter((s) => !s.exit_date).map((s) => (
            <tr key={s.id}>
              <td className="mono">{s.person_no}</td>
              <td>{s.legal_name}</td>
              <td>{s.grade ?? '—'}</td>
              <td>
                <select
                  value={decisions[s.id]?.action ?? ''}
                  onChange={(e) => set(s.id, e.target.value, decisions[s.id]?.nextGradeId ?? null)}
                >
                  <option value="">Decide…</option>
                  <option value="PROMOTE">Promote</option>
                  <option value="RETAIN">Retain</option>
                  <option value="GRADUATE">Graduate</option>
                  <option value="DO_NOT_ENROLL">Do not enroll</option>
                </select>
              </td>
              <td className="mono" style={{ fontSize: 11 }}>{decisions[s.id]?.action === 'PROMOTE' ? 'uses decision grade' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="accent" onClick={execute} disabled={busy}>Execute rollover</button>
      </div>
      {summary && (
        <div className="card" style={{ marginTop: 12 }}>
          <b>Rollover complete:</b> {summary.promoted} promoted · {summary.retained} retained · {summary.graduated} graduated · {summary.notEnrolled} not enrolled · {summary.skippedNoDecision} undecided (skipped)
        </div>
      )}
    </>
  )
}
