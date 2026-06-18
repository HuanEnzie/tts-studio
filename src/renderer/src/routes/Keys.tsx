import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { KeyRound, Plus, ShieldCheck, Trash2, CheckCircle2, Loader2, Ban } from 'lucide-react'
import { Button } from '../design/Button'
import { PageHeader } from '../design/PageHeader'
import { EmptyState } from '../design/EmptyState'
import { Modal } from '../design/Modal'
import { Field, Input, Textarea, Select } from '../design/Input'
import { ipc, type KeyMeta } from '../lib/ipc'
import { useQuota } from '../store/quota'
import { toast } from '../store/toast'
import type { KeyView, KeyTier } from '@shared/types'

export function Keys() {
  const [keys, setKeys] = useState<KeyMeta[]>([])
  const summary = useQuota((s) => s.summary)
  const refreshQuota = useQuota((s) => s.refresh)
  const [adding, setAdding] = useState(false)
  const [validating, setValidating] = useState<string | null>(null)

  const refresh = async () => {
    setKeys(await ipc.keys.list())
    refreshQuota()
  }
  useEffect(() => { refresh() }, [])

  const usageOf = (id: string): KeyView | undefined => summary.keys.find((k) => k.id === id)

  const update = async (id: string, patch: Parameters<typeof ipc.keys.update>[1]) => {
    await ipc.keys.update(id, patch)
    refresh()
  }

  const validate = async (id: string) => {
    setValidating(id)
    const ok = await ipc.keys.validate(id)
    setValidating(null)
    ok ? toast.success('Key hợp lệ') : toast.error('Key không hợp lệ hoặc đã hết hạn')
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-7">
      <PageHeader title="API Keys"
        subtitle="Pool key Gemini — lưu mã hóa tại máy, tự xoay vòng. Đặt tier Free/Paid cho từng key."
        action={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Thêm key</Button>} />

      {keys.length === 0 ? (
        <EmptyState icon={KeyRound} title="Chưa có API key nào"
          hint="Thêm key Gemini để bắt đầu. App tự đếm quota từng key và xoay vòng khi gặp giới hạn."
          action={<>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Thêm key</Button>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-faint"><ShieldCheck className="h-3.5 w-3.5 text-status-done" /> Key được mã hóa bằng safeStorage của hệ điều hành</span>
          </>} />
      ) : (
        <div className="flex flex-col gap-2">
          {keys.map((k, i) => {
            const u = usageOf(k.id)
            const used = u?.used ?? 0
            const isPaid = k.tier === 'paid'
            const pct = !isPaid && k.dailyLimit ? Math.min(100, (used / k.dailyLimit) * 100) : 0
            return (
              <motion.div key={k.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className={'flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 ' + (k.banned ? 'border-status-error/40' : 'border-border')}>
                <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (k.active && !k.banned ? 'bg-accent-soft' : 'bg-surface-hover')}>
                  <KeyRound className={'h-4 w-4 ' + (k.active && !k.banned ? 'text-accent-to' : 'text-ink-faint')} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">{k.label}</p>
                    {k.banned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-error/10 px-2 py-0.5 text-[11px] font-medium text-status-error">
                        <Ban className="h-3 w-3" /> Bị cấm
                      </span>
                    )}
                  </div>
                  {k.banned && k.bannedReason ? (
                    <p className="truncate text-xs text-status-error" title={k.bannedReason}>{k.bannedReason}</p>
                  ) : (
                    k.account && <p className="truncate text-xs text-ink-faint">{k.account}</p>
                  )}
                </div>

                {/* tier */}
                <select
                  value={k.tier}
                  onChange={(e) => update(k.id, { tier: e.target.value as KeyTier })}
                  className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-ink outline-none"
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>

                {/* usage */}
                <div className="w-44">
                  {isPaid ? (
                    <div className="text-xs text-ink-muted">
                      <span className="tnum text-ink">{used}</span> lượt hôm nay <span className="text-ink-faint">(tính phí)</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ink-muted">Hôm nay</span>
                        <span className={'tnum ' + (u?.exhausted ? 'text-status-error' : 'text-ink-muted')}>
                          {used}/
                          <input
                            type="number"
                            value={k.dailyLimit}
                            onChange={(e) => update(k.id, { dailyLimit: Math.max(1, Number(e.target.value) || 1) })}
                            className="tnum w-12 bg-transparent text-ink outline-none focus:underline"
                          />
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                        <div className={'h-full rounded-full ' + (u?.exhausted ? 'bg-status-error' : 'bg-accent-gradient')} style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  )}
                </div>

                {k.banned && (
                  <button onClick={() => update(k.id, { banned: false })} title="Bỏ cấm" className="rounded-lg px-2 py-1 text-xs text-status-warn transition hover:bg-surface-hover">
                    Bỏ cấm
                  </button>
                )}

                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
                  <input type="checkbox" checked={k.active} className="h-4 w-4 accent-[#7C5CFF]"
                    onChange={(e) => update(k.id, { active: e.target.checked })} />
                  Bật
                </label>
                <button onClick={() => validate(k.id)} title="Kiểm tra key" className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-ink">
                  {validating === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                </button>
                <button onClick={async () => { await ipc.keys.remove(k.id); refresh(); toast.success('Đã xóa key') }} title="Xóa" className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-status-error">
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            )
          })}
        </div>
      )}

      <AddKeyModal open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); refresh() }} />
    </div>
  )
}

function AddKeyModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [tab, setTab] = useState<'single' | 'bulk'>('single')
  const [label, setLabel] = useState('')
  const [account, setAccount] = useState('')
  const [key, setKey] = useState('')
  const [bulk, setBulk] = useState('')
  const [tier, setTier] = useState<KeyTier>('free')
  useEffect(() => { if (open) { setTab('single'); setLabel(''); setAccount(''); setKey(''); setBulk(''); setTier('free') } }, [open])

  const submit = async () => {
    if (tab === 'single') {
      if (!key.trim()) { toast.error('Nhập API key'); return }
      await ipc.keys.add(label, account, key, tier)
      toast.success('Đã thêm key')
    } else {
      const n = await ipc.keys.addBulk(bulk, tier)
      toast.success(`Đã thêm ${n} key`)
    }
    onDone()
  }

  return (
    <Modal open={open} onClose={onClose} title="Thêm API key" width={520}
      footer={<><Button variant="ghost" onClick={onClose}>Hủy</Button><Button variant="primary" onClick={submit}>Thêm</Button></>}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Button size="sm" variant={tab === 'single' ? 'primary' : 'secondary'} onClick={() => setTab('single')}>Một key</Button>
          <Button size="sm" variant={tab === 'bulk' ? 'primary' : 'secondary'} onClick={() => setTab('bulk')}>Nhiều key</Button>
        </div>
        <Field label="Tier" hint="Free = giới hạn lượt/ngày. Paid = không giới hạn, đếm như chi phí.">
          <Select value={tier} onChange={(e) => setTier(e.target.value as KeyTier)}>
            <option value="free">Free (có giới hạn ngày)</option>
            <option value="paid">Paid (không giới hạn)</option>
          </Select>
        </Field>
        {tab === 'single' ? (
          <>
            <Field label="Nhãn (tùy chọn)"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nick A - Project 1" /></Field>
            <Field label="Tài khoản (tùy chọn)"><Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="email@gmail.com" /></Field>
            <Field label="API key"><Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza... hoặc AQ...." /></Field>
          </>
        ) : (
          <Field label="Mỗi dòng một key" hint='Định dạng: "key" hoặc "nhãn,key" hoặc "nhãn,tài khoản,key"'>
            <Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} className="h-44 font-mono text-[13px]" placeholder={'AIzaKey1...\nNick A,AIzaKey2...\nNick B,b@gmail.com,AIzaKey3...'} />
          </Field>
        )}
      </div>
    </Modal>
  )
}
