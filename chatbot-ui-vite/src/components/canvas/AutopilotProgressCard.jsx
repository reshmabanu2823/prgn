import { Sparkles, CheckCircle2, CircleDot, Circle, ArrowRight, Wand2, Pencil } from 'lucide-react'

export default function AutopilotProgressCard({ isStreaming = false, onEdit, onMakeItReal }) {
  const steps = [
    { label: 'Understanding request', state: 'done' },
    { label: 'Identifying structure', state: 'done' },
    { label: 'Building visualization', state: isStreaming ? 'active' : 'done' },
    { label: 'Preparing response', state: isStreaming ? 'pending' : 'done' },
  ]

  const getStepIcon = (state) => {
    switch (state) {
      case 'done':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      case 'active':
        return <CircleDot className="w-3.5 h-3.5 text-[#F2D06B] animate-spin" />
      default:
        return <Circle className="w-3 h-3 text-white/30" />
    }
  }

  return (
    <div className="w-full my-2.5 p-3.5 rounded-xl border border-[#d4af37]/25 bg-gradient-to-r from-[#121215]/95 via-[#0e0e11]/95 to-[#151518]/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex flex-col gap-2.5 transition-all duration-300 hover:border-[#d4af37]/40">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/30 shadow-[0_0_10px_rgba(212,175,55,0.15)]">
            <Sparkles className="w-3.5 h-3.5 text-[#e5c76b] animate-pulse" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#e5c76b]">
            PRAGNA AUTOPILOT {isStreaming ? '• EXECUTING' : '• COMPLETE'}
          </span>
        </div>

        {!isStreaming && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-semibold">
            ✓ Complete
          </span>
        )}
      </div>

      {/* Progress Stages */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/[0.06] text-[11px]">
        {steps.map((s, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-[#c9bda2]">
            {getStepIcon(s.state)}
            <span className={s.state === 'active' ? 'text-[#e5c76b] font-semibold' : s.state === 'done' ? 'text-[#f0e6d3]' : 'text-[#a89878]/60'}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Action shortcuts once completed */}
      {!isStreaming && (
        <div className="flex items-center gap-2 pt-1.5 border-t border-white/[0.06]">
          {onMakeItReal && (
            <button
              onClick={onMakeItReal}
              className="group flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-[#d4af37]/20 via-[#e5c76b]/15 to-[#d4af37]/20 hover:from-[#d4af37]/35 hover:via-[#e5c76b]/25 hover:to-[#d4af37]/35 border border-[#d4af37]/45 text-[11px] font-bold text-[#f0e6d3] hover:text-white shadow-[0_0_12px_rgba(212,175,55,0.2)] transition-all duration-200"
            >
              <Sparkles className="w-3 h-3 text-[#e5c76b] group-hover:rotate-12 transition-transform" />
              <span className="tracking-wide">✦ MAKE IT REAL</span>
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[#d4af37]/30 text-[11px] text-[#c9bda2] hover:text-[#f0e6d3] transition-colors"
            >
              <Pencil className="w-3 h-3 text-[#a89878]" />
              <span>Edit</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
