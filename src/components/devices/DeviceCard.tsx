import { useState, useEffect } from 'react'
import { Device } from '@/types'
import { stopSession, calculateSessionPrice } from '@/lib/sessions'
import { sanitizeError } from '@/lib/errors'
import { isGhostRisk } from '@/hooks/useDevices'
import { Gamepad2, Clock, User, Square, Play, Users } from 'lucide-react'
import { toast } from 'sonner'
import clsx from 'clsx'
import StartSessionModal from './StartSessionModal'

function useElapsedTime(startedAt: string | undefined) {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    if (!startedAt) { setElapsed(''); return }
    const update = () => {
      const diff = Date.now() - new Date(startedAt).getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setElapsed(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return elapsed
}

interface Props { device: Device; onUpdate: () => void }

export default function DeviceCard({ device, onUpdate }: Props) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [showStart, setShowStart] = useState(false)
  const [estimatedPrice, setEstimatedPrice] = useState(0)

  const isActive = !!device.active_session
  const session  = device.active_session
  const elapsed  = useElapsedTime(session?.started_at)
  const ghostRisk = session ? isGhostRisk(session.started_at) : false

  // Update estimated price every second
  useEffect(() => {
    if (!session) {
      setEstimatedPrice(0)
      return
    }

    const update = () => {
      const durationSeconds = (Date.now() - new Date(session.started_at).getTime()) / 1000
      // Use price_single as hourly rate (adjust based on your data structure)
      const hourlyRate = device.price_single || 0
      const price = calculateSessionPrice(durationSeconds, hourlyRate)
      setEstimatedPrice(price)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [session, device.price_single])

  /**
   * Handle stopping the current session with double-click guard
   * and error sanitization
   */
  const handleEnd = async () => {
    if (!session || isProcessing) return // Idempotency guard

    setIsProcessing(true)
    try {
      const result = await stopSession(session.id)
      // Show server-calculated cost (authoritative), fall back to client estimate
      const actualCost = result?.cost ?? estimatedPrice
      toast.success(`تمت الجلسة — ${actualCost} جنيه`)
      onUpdate()
    } catch (error) {
      const appError = sanitizeError(error)
      toast.error(appError.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <div
        className="relative overflow-hidden rounded-2xl transition-all duration-300 cursor-default select-none"
        style={{
          background: isActive
            ? 'linear-gradient(135deg, rgba(0,229,160,0.05), rgba(17,17,32,1) 50%)'
            : 'var(--ps-card)',
          border: isActive
            ? '1px solid rgba(0,229,160,0.25)'
            : '1px solid var(--ps-border)',
          boxShadow: isActive
            ? '0 0 24px rgba(0,229,160,0.08), inset 0 1px 0 rgba(0,229,160,0.05)'
            : '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {/* Active top bar */}
        {isActive && (
          <div className="absolute top-0 inset-x-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(0,229,160,0.8), transparent)' }}
          />
        )}

        {/* Device number watermark */}
        <div className="absolute bottom-2 left-2 font-display text-6xl leading-none pointer-events-none select-none"
          style={{ color: isActive ? 'rgba(0,229,160,0.04)' : 'rgba(255,255,255,0.02)', fontSize: '72px' }}
        >
          {device.id}
        </div>

        <div className="p-4 relative">
          {/* Header row */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-sm text-ps-text leading-none mb-1.5">{device.name}</p>
              <span className={clsx(
                'inline-flex items-center text-xs font-mono font-bold px-2 py-0.5 rounded-md',
                device.type === 'PS5'
                  ? 'text-ps-blue-light'
                  : 'text-ps-purple'
              )}
                style={{
                  background: device.type === 'PS5' ? 'rgba(0,87,255,0.1)' : 'rgba(155,109,255,0.1)',
                  border: device.type === 'PS5' ? '1px solid rgba(0,87,255,0.2)' : '1px solid rgba(155,109,255,0.2)',
                }}
              >{device.type}</span>
            </div>

            <div className={clsx('badge', isActive ? 'badge-active' : 'badge-idle')}>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
              {isActive ? 'نشط' : 'فارغ'}
            </div>
          </div>

          {/* Content */}
          {isActive && session ? (
            <div className="space-y-2 mb-3">
              {/* Timer */}
              <div className="rounded-xl px-3 py-2.5 flex items-center justify-between"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,229,160,0.1)' }}
              >
                <div className="flex items-center gap-1.5 text-ps-muted text-xs">
                  <Clock size={12} />
                  <span>وقت اللعب</span>
                </div>
                <span className="font-mono font-bold text-sm animate-timer"
                  style={{ color: 'var(--ps-green)', letterSpacing: '0.05em' }}
                >{elapsed}</span>
              </div>

              {/* Info chips */}
              <div className="flex gap-1.5">
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ps-muted flex-1"
                  style={{ background: 'rgba(0,0,0,0.25)' }}
                >
                  <Users size={11} />
                  {session.mode === 'single' ? 'Single' : 'Multi'}
                </div>
                {session.customer && (
                  <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ps-muted flex-1 overflow-hidden"
                    style={{ background: 'rgba(0,0,0,0.25)' }}
                  >
                    <User size={11} className="flex-shrink-0" />
                    <span className="truncate">{session.customer.name}</span>
                  </div>
                )}
              </div>

              {session.game_played && (
                <p className="text-xs text-ps-muted px-2.5 py-1.5 rounded-lg truncate"
                  style={{ background: 'rgba(0,0,0,0.25)' }}
                >
                  🎮 {session.game_played}
                </p>
              )}

              {/* Ghost Session Warning */}
              {ghostRisk && (
                <div className="flex items-center gap-2 rounded-md bg-amber-500/20 border border-amber-500/40 px-3 py-2"
                  style={{ background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.3)' }}
                >
                  <span className="text-amber-600 text-sm">⚠️</span>
                  <span className="text-amber-700 text-xs">جلسة طويلة — يرجى المراجعة</span>
                </div>
              )}

              <button
                onClick={handleEnd}
                disabled={isProcessing}
                className={clsx('btn-danger w-full py-2 text-sm', isProcessing && 'opacity-50 cursor-not-allowed')}
              >
                {isProcessing
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderTopColor: 'var(--ps-red)' }} />جاري الإنهاء</>
                  : <><Square size={13} />إنهاء الجلسة</>
                }
              </button>
            </div>
          ) : (
            <div className="py-5 flex flex-col items-center justify-center gap-1 mb-3">
              <Gamepad2 size={24} style={{ color: 'var(--ps-border-hi)', opacity: 0.5 }} />
              <p className="text-xs text-ps-muted mt-1">{device.price_single} / {device.price_multi} جنيه/س</p>
            </div>
          )}

          {!isActive && (
            <button onClick={() => setShowStart(true)} disabled={isProcessing} className={clsx('btn-primary w-full py-2.5 text-sm', isProcessing && 'opacity-50 cursor-not-allowed')}>
              <Play size={14} />
              بدء جلسة
            </button>
          )}
        </div>
      </div>

      {showStart && (
        <StartSessionModal
          device={device}
          onClose={() => setShowStart(false)}
          onSuccess={() => { setShowStart(false); onUpdate() }}
        />
      )}
    </>
  )
}
