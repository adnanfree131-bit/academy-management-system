import { useEffect, useState } from 'react'
import { api, today } from '../api.js'

type Row = { personId: string; personNo: string; name: string; category: string | null }
type Cat = 'PRESENT' | 'ABSENT_UNEXCUSED' | 'LATE'
type Meta = { grades: Record<string, string>; sections: Record<string, string[]> }

export function AttendanceScreen() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [gradeName, setGradeName] = useState('')
  const [sectionIdx, setSectionIdx] = useState(0)
  const [day, setDay] = useState(today())
  const [rows, setRows] = useState<Row[]>([])
  const [marks, setMarks] = useState<Record<string, Cat>>({})
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<Meta>('GET', '/api/meta').then(setMeta).catch((e) => setErr(e.message))
  }, [])

  const sectionId = meta?.sections[gradeName]?.[sectionIdx]

  useEffect(() => {
    setOk(''); setErr(''); setMarks({})
    if (!sectionId) return
    api<Row[]>('GET', `/api/attendance/roster/${sectionId}?day=${day}`)
      .then(setRows)
      .catch((e) => setErr(e.message))
  }, [sectionId, day])

  const setAll = (c: Cat) => {
    const m: Record<string, Cat> = {}
    for (const r of rows) m[r.personId] = c
    setMarks(m)
  }
  const toggle = (personId: string, c: Cat) => {
    setMarks((m) => ({ ...m, [personId]: m[personId] === c ? 'PRESENT' : c }))
  }

  const submit = async () => {
    setBusy(true); setErr(''); setOk('')
    try {
      const list = rows.map((r) => ({ personId: r.personId, category: marks[r.personId] ?? 'PRESENT' }))
      await api('POST', '/api/attendance/mark', { sectionId, day, marks: list })
      setOk(`Attendance recorded for ${rows.length} students.`)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  const gradeNames = meta ? Object.keys(meta.grades) : []

  return (
    <>
      <h1>Attendance</h1>
      <p className="sub">Register is validated against the academic calendar — non-session days are refused by the server.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={gradeName} onChange={(e) => { setGradeName(e.target.value); setSectionIdx(0) }}>
          <option value="">Grade…</option>
          {gradeNames.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select value={sectionIdx} onChange={(e) => setSectionIdx(Number(e.target.value))} disabled={!gradeName}>
          {(meta?.sections[gradeName] ?? []).map((sid, i) => <option key={sid} value={i}>Section {String.fromCharCode(65 + i)}</option>)}
        </select>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <button className="ghost" onClick={() => setAll('PRESENT')}>All present</button>
        <button className="accent" onClick={submit} disabled={!sectionId || busy || rows.length === 0}>Submit</button>
      </div>
      {ok && <p className="notice">{ok}</p>}
      {err && <p className="error">{err}</p>}
      {sectionId && (
        <table>
          <thead><tr><th>Roll</th><th>Name</th><th>Mark</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.personId}>
                <td className="mono">{r.personNo}</td>
                <td>{r.name}</td>
                <td>
                  <div className="mark-cell">
                    {(['PRESENT', 'LATE', 'ABSENT_UNEXCUSED'] as Cat[]).map((c) => (
                      <button
                        key={c}
                        className={marks[r.personId] === c ? `on ${c === 'ABSENT_UNEXCUSED' ? 'absent' : c === 'LATE' ? 'late' : ''}` : ''}
                        onClick={() => toggle(r.personId, c)}
                      >
                        {c === 'PRESENT' ? 'P' : c === 'LATE' ? 'L' : 'A'}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
