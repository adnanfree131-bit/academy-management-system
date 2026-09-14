import { useState } from 'react'
import { api } from '../api.js'

export function OnboardScreen({ onDone }: { onDone: () => void }) {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminName, setAdminName] = useState('')
  const [yearName, setYearName] = useState('2026-2027')
  const [grades, setGrades] = useState('Grade 1, Grade 2, Grade 3')
  const [sections, setSections] = useState(1)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const submit = async () => {
    setErr(''); setOk('')
    try {
      const gradeList = grades.split(',').map((g) => g.trim()).filter(Boolean)
      const body = {
        tenantSlug: slug.toLowerCase(),
        tenantName: name,
        adminEmail,
        adminName,
        campusName: 'Main Campus',
        yearName,
        yearStart: `${yearName.slice(0, 4)}-08-01`,
        yearEnd: `${Number(yearName.slice(0, 4)) + 1}-05-31`,
        grades: gradeList.map((g, i) => ({ name: g, rank: i + 1 })),
        sectionsPerGrade: sections,
        weekdaySessions: [1, 2, 3, 4, 5],
      }
      await api('POST', '/api/onboard', body)
      setOk(`Academy "${name}" created. Admin ${adminEmail} can now sign in with an OTP code.`)
    } catch (e: any) { setErr(e.message) }
  }

  return (
    <>
      <h1>New Academy</h1>
      <p className="sub">Provisions the tenant, academic year, Mon-Fri calendar, grades, sections, and default fee heads.</p>
      <div className="card">
        <div className="grid2">
          <label>Subdomain slug<br /><input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="alpha-school" /></label>
          <label>Academy name<br /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alpha School" /></label>
          <label>Admin email<br /><input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="owner@alpha.edu" /></label>
          <label>Admin name<br /><input value={adminName} onChange={(e) => setAdminName(e.target.value)} /></label>
          <label>Academic year<br /><input value={yearName} onChange={(e) => setYearName(e.target.value)} /></label>
          <label>Sections per grade<br /><input type="number" min={1} max={10} value={sections} onChange={(e) => setSections(Number(e.target.value))} /></label>
        </div>
        <label style={{ display: 'block', marginTop: 12 }}>Grades (comma-separated)<br />
          <input style={{ width: '100%' }} value={grades} onChange={(e) => setGrades(e.target.value)} />
        </label>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="accent" onClick={submit} disabled={!slug || !name || !adminEmail}>Create academy</button>
          <button className="ghost" onClick={onDone}>Back</button>
        </div>
        {ok && <p className="notice">{ok}</p>}
        {err && <p className="error">{err}</p>}
      </div>
    </>
  )
}
