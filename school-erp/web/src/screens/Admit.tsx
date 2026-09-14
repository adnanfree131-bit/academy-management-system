import { useEffect, useState } from 'react'
import { api } from '../api.js'

type Meta = {
  campusId: string
  yearId: string
  grades: Record<string, string>
  sections: Record<string, string[]>
  feeHeads: Array<{ id: string; name: string; priority: number }>
}

export function AdmitScreen() {
  const [form, setForm] = useState({
    legalName: '', dateOfBirth: '', gender: '', entryDate: new Date().toISOString().slice(0, 10),
  })
  const [guardians, setGuardians] = useState<Array<{ legalName: string; relationLabel: string; phone: string; email: string; canPay: boolean; canPickup: boolean }>>([])
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [meta, setMeta] = useState<Meta | null>(null)
  const [gradeName, setGradeName] = useState('')
  const [sectionIdx, setSectionIdx] = useState(0)

  useEffect(() => {
    api<Meta>('GET', '/api/meta').then(setMeta).catch((e) => setErr(e.message))
  }, [])

  const submit = async () => {
    setErr(''); setOk('')
    try {
      const body: any = {
        legalName: form.legalName,
        campusId: meta!.campusId,
        gradeId: meta!.grades[gradeName],
        yearId: meta!.yearId,
        entryDate: form.entryDate,
        sectionId: meta!.sections[gradeName]?.[sectionIdx],
        guardians: guardians.filter((g) => g.legalName),
      }
      if (form.dateOfBirth) body.dateOfBirth = form.dateOfBirth
      if (form.gender) body.gender = form.gender
      const r = await api<{ personId: string }>('POST', '/api/students/admit', body)
      setOk(`Admitted (${r.personId.slice(0, 8)}…). Roll number auto-assigned.`)
      setForm({ legalName: '', dateOfBirth: '', gender: '', entryDate: form.entryDate })
      setGuardians([])
    } catch (e: any) { setErr(e.message) }
  }

  const gradeNames = meta ? Object.keys(meta.grades) : []

  return (
    <>
      <h1>Admit Student</h1>
      <p className="sub">Creates the person, the dated enrollment, section roster, and guardian links with rights.</p>
      <div className="card">
        <h2>Student</h2>
        <div className="grid2">
          <label>Legal name *<br /><input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></label>
          <label>Date of birth<br /><input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></label>
          <label>Gender<br /><input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} /></label>
          <label>Entry date<br /><input type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} /></label>
          <label>Grade<br />
            <select value={gradeName} onChange={(e) => { setGradeName(e.target.value); setSectionIdx(0) }}>
              <option value="">Select…</option>
              {gradeNames.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label>Section<br />
            <select value={sectionIdx} onChange={(e) => setSectionIdx(Number(e.target.value))} disabled={!gradeName}>
              {(meta?.sections[gradeName] ?? []).map((sid, i) => <option key={sid} value={i}>{String.fromCharCode(65 + i)}</option>)}
            </select>
          </label>
        </div>

        <h2>Guardians</h2>
        {guardians.map((g, i) => (
          <div key={i} className="card" style={{ marginBottom: 8 }}>
            <div className="grid2">
              <label>Name<br /><input value={g.legalName} onChange={(e) => setGuardian(i, { legalName: e.target.value })} /></label>
              <label>Relation<br /><input value={g.relationLabel} onChange={(e) => setGuardian(i, { relationLabel: e.target.value })} placeholder="mother / father / uncle" /></label>
              <label>Phone<br /><input value={g.phone} onChange={(e) => setGuardian(i, { phone: e.target.value })} /></label>
              <label>Email (portal access)<br /><input value={g.email} onChange={(e) => setGuardian(i, { email: e.target.value })} /></label>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <label><input type="checkbox" checked={g.canPay} onChange={(e) => setGuardian(i, { canPay: e.target.checked })} /> can pay fees</label>
              <label><input type="checkbox" checked={g.canPickup} onChange={(e) => setGuardian(i, { canPickup: e.target.checked })} /> can pick up</label>
              <button className="ghost" onClick={() => setGuardians(guardians.filter((_, j) => j !== i))}>Remove</button>
            </div>
          </div>
        ))}
        <button className="ghost" onClick={() => setGuardians([...guardians, { legalName: '', relationLabel: '', phone: '', email: '', canPay: false, canPickup: false }])}>+ Add guardian</button>

        <div className="row" style={{ marginTop: 16 }}>
          <button className="accent" onClick={submit} disabled={!form.legalName || !meta || !gradeName}>Admit student</button>
        </div>
        {ok && <p className="notice">{ok}</p>}
        {err && <p className="error">{err}</p>}
      </div>
    </>
  )

  function setGuardian(i: number, patch: Partial<typeof guardians[number]>) {
    setGuardians((gs) => gs.map((g, j) => (j === i ? { ...g, ...patch } : g)))
  }
}
