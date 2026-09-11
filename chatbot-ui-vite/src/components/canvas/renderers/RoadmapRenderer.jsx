import { Map, CheckCircle2, Clock, CircleDot, ChevronRight } from 'lucide-react'

export default function RoadmapRenderer({ data }) {
  const stages = Array.isArray(data?.stages)
    ? data.stages
    : Array.isArray(data?.phases)
    ? data.phases
    : []

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'done':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          pill: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
          dot: 'bg-emerald-400',
        }
      case 'current':
      case 'in_progress':
      case 'active':
        return {
          icon: <Clock className="w-4 h-4 text-[#F2D06B]" />,
          pill: 'bg-[#D4AF37]/20 border-[#D4AF37]/40 text-[#F2D06B]',
          dot: 'bg-[#F2D06B] animate-pulse',
        }
      default:
        return {
          icon: <CircleDot className="w-4 h-4 text-white/40" />,
          pill: 'bg-white/5 border-white/10 text-white/60',
          dot: 'bg-white/30',
        }
    }
  }

  return (
    <div className="w-full flex flex-col gap-4 p-4 bg-black/40 rounded-xl border border-[#D4AF37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      <div className="flex flex-col gap-3">
        {stages.map((stage, idx) => {
          const status = stage.status || 'upcoming'
          const badge = getStatusBadge(status)
          const milestones = Array.isArray(stage.milestones)
            ? stage.milestones
            : Array.isArray(stage.tasks)
            ? stage.tasks
            : []

          return (
            <div
              key={idx}
              className="flex flex-col rounded-xl border border-[#D4AF37]/30 bg-black/60 overflow-hidden hover:border-[#D4AF37]/60 transition-all duration-200"
            >
              {/* Stage Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-gradient-to-r from-[#D4AF37]/15 via-[#D4AF37]/5 to-transparent border-b border-[#D4AF37]/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-xs font-bold text-[#F2D06B]">
                    {stage.stage || idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white/95">{stage.title || `Stage ${idx + 1}`}</h4>
                    {stage.duration && (
                      <span className="text-[11px] text-[#F2D06B]/80 font-mono">
                        ⏱ {stage.duration}
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold uppercase tracking-wider border ${badge.pill}`}
                >
                  {badge.icon}
                  <span>{status}</span>
                </span>
              </div>

              {/* Milestones / Checklist */}
              {milestones.length > 0 && (
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {milestones.map((m, mIdx) => {
                    const label = typeof m === 'string' ? m : (m.title || m.label || 'Milestone')
                    const isDone = typeof m === 'object' ? m.completed : status === 'completed'

                    return (
                      <div
                        key={mIdx}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/85"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span className={isDone ? 'line-through text-white/40' : 'text-white/90 font-medium'}>
                          {label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
