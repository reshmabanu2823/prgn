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
          pill: 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300/90',
          dot: 'bg-emerald-400',
        }
      case 'current':
      case 'in_progress':
      case 'active':
        return {
          icon: <Clock className="w-4 h-4 text-[#e5c76b]" />,
          pill: 'bg-[#d4af37]/15 border-[#d4af37]/35 text-[#e5c76b]',
          dot: 'bg-[#e5c76b] animate-pulse',
        }
      default:
        return {
          icon: <CircleDot className="w-4 h-4 text-[#a89878]/60" />,
          pill: 'bg-white/[0.04] border-white/[0.08] text-[#a89878]',
          dot: 'bg-white/30',
        }
    }
  }

  return (
    <div className="w-full flex flex-col gap-4 p-4 bg-[#0a0a0c]/60 rounded-xl border border-[#d4af37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
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
              className="flex flex-col rounded-xl border border-[#d4af37]/25 bg-[#121215]/95 overflow-hidden hover:border-[#d4af37]/50 shadow-md transition-all duration-200"
            >
              {/* Stage Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-gradient-to-r from-[#d4af37]/15 via-[#d4af37]/5 to-transparent border-b border-[#d4af37]/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/35 flex items-center justify-center text-xs font-bold text-[#e5c76b]">
                    {stage.stage || idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#f0e6d3]">{stage.title || `Stage ${idx + 1}`}</h4>
                    {stage.duration && (
                      <span className="text-[11px] text-[#e5c76b]/80 font-mono">
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
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-[#d4af37]/30 text-xs text-[#c9bda2] transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span className={isDone ? 'line-through text-[#a89878]/50' : 'text-[#f0e6d3] font-medium'}>
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
