import { Sparkles, CheckCircle2, CircleDot, Circle, ArrowRight, Wand2, Maximize2, Pencil } from 'lucide-react'

export default function AutopilotProgressCard({ isStreaming = false, onExpand, onEdit, onMakeItReal }) {
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
    <div className="w-full my-2.5 p-3.5 rounded-xl border border-[#D4AF37]/35 bg-gradient-to-r from-[#18181B]/95 to-[#0B0B0C]/95 backdrop-blur-md shadow-lg flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40">
            <Sparkles className="w-3.5 h-3.5 text-[#F2D06B] animate-pulse" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#F2D06B]">
            PRAGNA AUTOPILOT {isStreaming ? '• EXECUTING' : '• COMPLETE'}
          </span>
        </div>

        {!isStreaming && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
            ✓ Complete
          </span>
        )}
      </div>

      {/* Progress Stages */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/5 text-[11px]">
        {steps.map((s, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-white/75">
            {getStepIcon(s.state)}
            <span className={s.state === 'active' ? 'text-[#F2D06B] font-semibold' : s.state === 'done' ? 'text-white/90' : 'text-white/40'}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Action shortcuts once completed */}
      {!isStreaming && (
        <div className="flex items-center gap-2 pt-1.5 border-t border-white/5">
          {onMakeItReal && (
            <button
              onClick={onMakeItReal}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#D4AF37]/25 to-[#F2D06B]/20 hover:from-[#D4AF37]/40 hover:to-[#F2D06B]/30 border border-[#D4AF37]/50 text-[11px] font-bold text-[#F2D06B] transition-all"
            >
              <Sparkles className="w-3 h-3 text-[#F2D06B]" />
              <span>✦ MAKE IT REAL</span>
            </button>
          )}
          {onExpand && (
            <button
              onClick={onExpand}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-white/80 hover:text-white transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Expand</span>
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-white/80 hover:text-white transition-colors"
            >
              <Pencil className="w-3 h-3" />
              <span>Edit</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
