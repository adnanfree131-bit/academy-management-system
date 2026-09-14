import { useEffect, useState } from 'react'
import { api, fmtMoney, today } from '../api.js'

export function FeeDeskScreen() {
  const [tab, setTab] = useState<'collect' | 'session' | 'invoice'>('collect')
  return (
    <>
      <h1>Fee Desk</h1>
      <p className="sub">Posted ledger: receipts get unique serials; allocation is deterministic by head priority (overridable per payment).</p>
      <div className="row" style={{ marginBottom: 12 }}>
        {(['collect', 'session', 'invoice'] as const).map((t) => (
          <button key={t} className={tab === t ? 'accent' : 'ghost'} onClick={() => setTab(t)}>
            {t === 'collect' ? 'Collect payment' : t === 'session' ? 'Cash session' : 'Post invoice'}
          </button>
        ))}
      </div>
      {tab === 'collect' && <CollectTab />}
      {tab === 'session' && <SessionTab />}
      {tab === 'invoice' && <InvoiceTab />}
    </>
  )
}

function useStudents() {
  const [students, setStudents] = useState<any[]>([])
  useEffect(() => { api<any[]>('GET', '/api/students').then(setStudents).catch(() => {}) }, [])
  return students
}

function useMeta() {
  const [meta, setMeta] = useState<{ feeHeads: Array<{ id: string; name: string; priority: number }> } | null>(null)
  useEffect(() => { api('GET', '/api/meta').then(setMeta).catch(() => {}) }, [])
  return meta
}

function CollectTab() {
  const students = useStudents()
  const [personId, setPersonId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [reference, setReference] = useState('')
  const [charges, setCharges] = useState<any[]>([])
  const [plan, setPlan] = useState<any[]>([])
  const [overrideOn, setOverrideOn] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    setCharges([]); setPlan([]); setOk(''); setErr('')
    if (!personId) return
    api('GET', `/api/finance/charges/${personId}`)
      .then((r: any) => { setCharges(r.charges); setPlan(r.samplePlan ?? []) })
      .catch((e) => setErr(e.message))
  }, [personId])

  const collect = async () => {
    setErr(''); setOk('')
    try {
      const r = await api('POST', '/api/finance/collect', {
        personId, amount: Number(amount), method, reference,
      })
      setOk(`Receipt R-${r.serial} recorded${r.excess > 0 ? ` · student credit ${fmtMoney(r.excess)} (overpayment)` : ''}.`)
      setAmount(''); setReference('')
    } catch (e: any) { setErr(e.message) }
  }

  const student = students.find((s) => s.id === personId)
  return (
    <div className="card">
      <div className="grid2">
        <label>Student<br />
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} style={{ width: '100%' }}>
            <option value="">Select…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.person_no} · {s.legal_name}</option>)}
          </select>
        </label>
        <label>Amount received<br /><input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>Method<br />
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label>Reference (cheque no / txn)<br /><input value={reference} onChange={(e) => setReference(e.target.value)} /></label>
      </div>

      {personId && (
        <>
          <h2>Open charges (priority order)</h2>
          <table>
            <thead><tr><th>Fee head</th><th className="num">Due</th></tr></thead>
            <tbody>
              {charges.length === 0 && <tr><td colSpan={2}>Nothing outstanding</td></tr>}
              {charges.map((c: any) => (
                <tr key={c.invoiceLineId}><td>{c.feeHeadPriority}</td><td className="num">{fmtMoney(c.due)}</td></tr>
              ))}
            </tbody>
          </table>
          {plan.length > 0 && Number(amount) > 0 && (
            <>
              <h2>Proposed split {overrideOn ? '(edit below)' : '(deterministic)'}</h2>
              <table>
                <tbody>
                  {plan.map((p: any, i: number) => (
                    <tr key={i}>
                      <td className="mono">{p.invoiceLineId.slice(0, 8)}…</td>
                      <td className="num">
                        {overrideOn
                          ? <input type="number" value={p.amount} onChange={(e) => setPlan(plan.map((x: any, j: number) => j === i ? { ...x, amount: Number(e.target.value) } : x))} />
                          : fmtMoney(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="accent" onClick={collect} disabled={!personId || !Number(amount)}>Confirm & collect</button>
      </div>
      {ok && <p className="notice">{ok}</p>}
      {err && <p className="error">{err}</p>}
      {student && <p className="sub">{student.legal_name} · {student.grade ?? '—'}</p>}
    </div>
  )
}

function SessionTab() {
  const [float, setFloat] = useState('0')
  const [sessionId, setSessionId] = useState('')
  const [counted, setCounted] = useState('')
  const [out, setOut] = useState<any>(null)
  const [err, setErr] = useState('')
  const open = async () => {
    setErr(''); setOut(null)
    try {
      const r = await api<{ id: string }>('POST', '/api/finance/cash-session/open', { openingFloat: Number(float) })
      setSessionId(r.id); setOut({ opened: r.id })
    } catch (e: any) { setErr(e.message) }
  }
  const close = async () => {
    setErr('')
    try {
      const r = await api('POST', '/api/finance/cash-session/close', { sessionId, countedTotal: Number(counted) })
      setOut({ closed: r })
    } catch (e: any) { setErr(e.message) }
  }
  return (
    <div className="card">
      <p className="sub">A cash payment requires an open session (F11). Close with the counted drawer total; variance is recorded, never hidden.</p>
      <div className="row">
        <input type="number" value={float} onChange={(e) => setFloat(e.target.value)} placeholder="Opening float" />
        <button className="ghost" onClick={open} disabled={!!sessionId}>Open session</button>
        <input type="number" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="Counted total" disabled={!sessionId} />
        <button className="accent" onClick={close} disabled={!sessionId || counted === ''}>Close session</button>
      </div>
      {out?.closed && (
        <p className={out.closed.variance === 0 ? 'notice' : 'error'}>
          Session closed. Variance: {fmtMoney(out.closed.variance)}
        </p>
      )}
      {err && <p className="error">{err}</p>}
    </div>
  )
}

function InvoiceTab() {
  const students = useStudents()
  const meta = useMeta()
  const [personId, setPersonId] = useState('')
  const [period, setPeriod] = useState(today().slice(0, 7))
  const [lines, setLines] = useState<Array<{ feeHeadId: string; amount: string }>>([])
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const addLine = () => {
    const first = meta?.feeHeads[0]?.id
    if (first) setLines([...lines, { feeHeadId: first, amount: '' }])
  }

  const post = async () => {
    setErr(''); setOk('')
    try {
      await api('POST', '/api/finance/invoices', {
        personId,
        billingPeriod: period,
        lines: lines.filter((l) => Number(l.amount) > 0).map((l) => ({ feeHeadId: l.feeHeadId, amount: Number(l.amount) })),
      })
      setOk('Invoice posted.')
      setLines([])
    } catch (e: any) { setErr(e.message) }
  }

  return (
    <div className="card">
      <div className="grid2">
        <label>Student<br />
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} style={{ width: '100%' }}>
            <option value="">Select…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.person_no} · {s.legal_name}</option>)}
          </select>
        </label>
        <label>Billing period<br /><input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-09" /></label>
      </div>
      <h2>Lines</h2>
      {lines.map((l, i) => (
        <div key={i} className="row" style={{ marginBottom: 8 }}>
          <select value={l.feeHeadId} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, feeHeadId: e.target.value } : x))}>
            {(meta?.feeHeads ?? []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <input type="number" min={0} placeholder="Amount" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
          <button className="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <div className="row">
        <button className="ghost" onClick={addLine} disabled={!meta}>+ Add line</button>
        <button className="accent" onClick={post} disabled={!personId || lines.length === 0}>Post invoice</button>
      </div>
      {ok && <p className="notice">{ok}</p>}
      {err && <p className="error">{err}</p>}
    </div>
  )
}
