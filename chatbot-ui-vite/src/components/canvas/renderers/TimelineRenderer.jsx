import { Calendar, CheckCircle2, Clock, CircleDot } from 'lucide-react'

export default function TimelineRenderer({ data }) {
  const events = Array.isArray(data?.events)
    ? data.events
    : Array.isArray(data?.milestones)
    ? data.milestones
    : []

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'done':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
          pill: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
          dot: 'bg-emerald-400 ring-emerald-400/30',
        }
      case 'in_progress':
      case 'current':
      case 'active':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-[#F2D06B]" />,
          pill: 'bg-[#D4AF37]/20 border-[#D4AF37]/40 text-[#F2D06B]',
          dot: 'bg-[#F2D06B] ring-[#D4AF37]/40 animate-pulse',
        }
      default:
        return {
          icon: <CircleDot className="w-3.5 h-3.5 text-white/40" />,
          pill: 'bg-white/5 border-white/10 text-white/60',
          dot: 'bg-white/30 ring-white/10',
        }
    }
  }

  return (
    <div className="w-full flex flex-col p-4 bg-black/40 rounded-xl border border-[#D4AF37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-[#D4AF37] before:via-[#D4AF37]/40 before:to-transparent">
        {events.map((evt, idx) => {
          const badge = getStatusBadge(evt.status)

          return (
            <div key={idx} className="relative group">
              {/* Timeline Marker Dot */}
              <div
                className={`absolute -left-[19.5px] top-1.5 w-3 h-3 rounded-full ring-4 ${badge.dot} transition-transform group-hover:scale-125`}
              />

              {/* Event Content Card */}
              <div className="p-3.5 rounded-xl border border-[#D4AF37]/25 bg-black/60 hover:border-[#D4AF37]/60 transition-all duration-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-[#F2D06B] bg-[#D4AF37]/10 px-2 py-0.5 rounded-md border border-[#D4AF37]/20">
                    <Calendar className="w-3 h-3" />
                    <span>{evt.date || evt.time || evt.period || `Step ${idx + 1}`}</span>
                  </div>

                  {evt.status && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${badge.pill}`}
                    >
                      {badge.icon}
                      <span>{evt.status}</span>
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-bold text-white/95">{evt.title || evt.name || 'Milestone'}</h4>

                {evt.description && (
                  <p className="text-[12px] text-white/70 mt-1 leading-relaxed">{evt.description}</p>
                )}

                {Array.isArray(evt.highlights) && evt.highlights.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {evt.highlights.map((h, hIdx) => (
                      <li key={hIdx} className="text-[11px] text-white/60 flex items-start gap-1.5">
                        <span className="text-[#D4AF37] mt-0.5">•</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
