import { useState } from 'react'
import { Tag, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

export default function KanbanRenderer({ data }) {
  const columns = Array.isArray(data?.columns)
    ? data.columns
    : [
        { id: 'todo', title: 'To Do', tasks: [] },
        { id: 'inprogress', title: 'In Progress', tasks: [] },
        { id: 'done', title: 'Done', tasks: [] },
      ]

  const getPriorityStyle = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
      case 'urgent':
        return 'bg-rose-500/15 border-rose-500/30 text-rose-300'
      case 'medium':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-300'
      default:
        return 'bg-[#D4AF37]/15 border-[#D4AF37]/30 text-[#F2D06B]'
    }
  }

  return (
    <div className="w-full flex gap-3 overflow-x-auto pb-2 p-3 bg-black/40 rounded-xl border border-[#D4AF37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {columns.map((col, idx) => {
        const tasks = Array.isArray(col.tasks) ? col.tasks : []

        return (
          <div
            key={col.id || idx}
            className="flex-1 min-w-[220px] max-w-[300px] flex flex-col rounded-xl bg-black/60 border border-[#D4AF37]/25 overflow-hidden"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between p-3 bg-[#D4AF37]/10 border-b border-[#D4AF37]/20">
              <span className="text-xs font-bold text-[#F2D06B] tracking-wide">
                {col.title || col.name || `Column ${idx + 1}`}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-black/60 border border-[#D4AF37]/30 text-[#F2D06B]">
                {tasks.length}
              </span>
            </div>

            {/* Task Cards */}
            <div className="p-2.5 flex flex-col gap-2 min-h-[140px]">
              {tasks.map((task, tIdx) => {
                const title = typeof task === 'string' ? task : (task.title || task.name || 'Task')
                const tag = typeof task === 'object' ? task.tag : null
                const priority = typeof task === 'object' ? task.priority : null
                const desc = typeof task === 'object' ? task.description : null

                return (
                  <div
                    key={tIdx}
                    className="p-3 rounded-lg bg-white/5 border border-white/10 hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/5 transition-all duration-150 flex flex-col gap-1.5"
                  >
                    <span className="text-xs font-medium text-white/90 leading-snug">{title}</span>

                    {desc && <p className="text-[11px] text-white/50 line-clamp-2">{desc}</p>}

                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {priority && (
                        <span
                          className={`text-[9.5px] uppercase font-bold px-1.5 py-0.5 rounded border ${getPriorityStyle(
                            priority
                          )}`}
                        >
                          {priority}
                        </span>
                      )}

                      {tag && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-white/15 text-white/60">
                          #{tag}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}

              {tasks.length === 0 && (
                <div className="h-full flex items-center justify-center text-[11px] text-white/30 italic py-6">
                  No tasks
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
