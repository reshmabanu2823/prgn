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
        return 'bg-rose-950/40 border-rose-500/30 text-rose-300/90'
      case 'medium':
        return 'bg-amber-950/40 border-amber-500/30 text-amber-300/90'
      default:
        return 'bg-[#d4af37]/15 border-[#d4af37]/35 text-[#e5c76b]'
    }
  }

  return (
    <div className="w-full flex gap-3 overflow-x-auto pb-2 p-3 bg-[#0a0a0c]/60 rounded-xl border border-[#d4af37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
      {columns.map((col, idx) => {
        const tasks = Array.isArray(col.tasks) ? col.tasks : []

        return (
          <div
            key={col.id || idx}
            className="flex-1 min-w-[220px] max-w-[300px] flex flex-col rounded-xl bg-[#121215]/95 border border-[#d4af37]/25 overflow-hidden shadow-md"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between p-3 bg-[#d4af37]/10 border-b border-[#d4af37]/20">
              <span className="text-xs font-bold text-[#f0e6d3] tracking-wide">
                {col.title || col.name || `Column ${idx + 1}`}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-[#0a0a0c]/80 border border-[#d4af37]/30 text-[#e5c76b]">
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
                    className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-[#d4af37]/45 hover:bg-[#d4af37]/5 transition-all duration-150 flex flex-col gap-1.5"
                  >
                    <span className="text-xs font-medium text-[#f0e6d3] leading-snug">{title}</span>

                    {desc && <p className="text-[11px] text-[#a89878] line-clamp-2">{desc}</p>}

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
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0a0a0c]/80 border border-white/[0.1] text-[#c9bda2]">
                          #{tag}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}

              {tasks.length === 0 && (
                <div className="h-full flex items-center justify-center text-[11px] text-[#a89878]/50 italic py-6">
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
