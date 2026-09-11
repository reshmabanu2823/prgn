import { useState } from 'react'
import { Sparkles, Layers, ChevronRight, ChevronDown } from 'lucide-react'

export default function MindmapRenderer({ data }) {
  const center = data?.center || data?.topic || data?.title || 'Core Topic'
  const branches = Array.isArray(data?.branches) ? data.branches : []
  const [expandedBranches, setExpandedBranches] = useState(() =>
    branches.reduce((acc, _, i) => ({ ...acc, [i]: true }), {})
  )

  const toggleBranch = (idx) => {
    setExpandedBranches((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div className="w-full flex flex-col gap-6 p-5 bg-black/40 rounded-xl border border-[#D4AF37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {/* Central Core Concept Node */}
      <div className="flex justify-center">
        <div className="relative group px-6 py-3.5 rounded-2xl bg-gradient-to-br from-[#D4AF37]/30 via-[#D4AF37]/15 to-black/80 border border-[#D4AF37]/60 shadow-[0_0_25px_rgba(212,175,55,0.25)] text-center">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-[#F2D06B]" />
            <h4 className="text-sm font-bold text-[#F2D06B] tracking-wide">{center}</h4>
          </div>
        </div>
      </div>

      {/* Radiating Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map((branch, idx) => {
          const isExpanded = !!expandedBranches[idx]
          const subnodes = Array.isArray(branch.subnodes)
            ? branch.subnodes
            : Array.isArray(branch.children)
            ? branch.children
            : []

          return (
            <div
              key={idx}
              className="flex flex-col rounded-xl border border-[#D4AF37]/30 bg-black/60 overflow-hidden hover:border-[#D4AF37]/60 transition-all duration-200 shadow-md"
            >
              {/* Branch Header */}
              <div
                onClick={() => toggleBranch(idx)}
                className="flex items-center justify-between p-3 bg-[#D4AF37]/10 border-b border-[#D4AF37]/20 cursor-pointer select-none hover:bg-[#D4AF37]/15 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#F2D06B]" />
                  <span className="text-xs font-semibold text-[#F2D06B]">
                    {branch.label || branch.title || `Branch ${idx + 1}`}
                  </span>
                </div>
                <button type="button" className="text-[#D4AF37]">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              {/* Subnodes List */}
              {isExpanded && (
                <div className="p-3 flex flex-col gap-1.5 animate-fadeIn">
                  {subnodes.map((sub, sIdx) => {
                    const label = typeof sub === 'string' ? sub : (sub.label || sub.name || JSON.stringify(sub))
                    const desc = typeof sub === 'object' ? sub.description : null

                    return (
                      <div
                        key={sIdx}
                        className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/85 text-xs hover:border-[#D4AF37]/40 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-white/90">{label}</span>
                          {desc && <p className="text-[11px] text-white/50 mt-0.5">{desc}</p>}
                        </div>
                      </div>
                    )
                  })}
                  {subnodes.length === 0 && (
                    <span className="text-[11px] text-white/40 italic px-1">No subnodes</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
