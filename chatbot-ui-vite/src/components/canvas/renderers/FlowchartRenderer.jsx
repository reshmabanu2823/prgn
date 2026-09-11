import { useState } from 'react'
import { ArrowRight, ArrowDown, Play, CheckCircle2, HelpCircle, Activity } from 'lucide-react'

export default function FlowchartRenderer({ data }) {
  const [selectedStep, setSelectedStep] = useState(null)

  const steps = Array.isArray(data?.steps)
    ? data.steps
    : Array.isArray(data?.nodes)
    ? data.nodes
    : []

  const getStepIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'start':
        return <Play className="w-4 h-4 text-emerald-400" />
      case 'end':
        return <CheckCircle2 className="w-4 h-4 text-[#e5c76b]" />
      case 'decision':
        return <HelpCircle className="w-4 h-4 text-amber-400" />
      default:
        return <Activity className="w-4 h-4 text-[#d4af37]" />
    }
  }

  const getStepBadge = (type) => {
    switch (type?.toLowerCase()) {
      case 'start':
        return 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300/90'
      case 'end':
        return 'bg-[#d4af37]/15 border-[#d4af37]/35 text-[#e5c76b]'
      case 'decision':
        return 'bg-amber-950/40 border-amber-500/30 text-amber-300/90'
      default:
        return 'bg-[#121215]/95 border-[#d4af37]/25 text-[#f0e6d3]'
    }
  }

  return (
    <div className="w-full flex flex-col gap-4 p-4 bg-[#0a0a0c]/60 rounded-xl border border-[#d4af37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
      {/* Flow Steps List */}
      <div className="flex flex-col items-center gap-2">
        {steps.map((step, idx) => {
          const isSelected = selectedStep === step.id || selectedStep === idx
          const isLast = idx === steps.length - 1

          return (
            <div key={step.id || idx} className="w-full flex flex-col items-center">
              {/* Step Card */}
              <div
                onClick={() => setSelectedStep(isSelected ? null : (step.id || idx))}
                className={`w-full max-w-lg p-3.5 rounded-xl border transition-all duration-200 cursor-pointer select-none flex items-start gap-3 shadow-md ${getStepBadge(step.type)} ${
                  isSelected ? 'ring-2 ring-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.22)]' : 'hover:border-[#d4af37]/60'
                }`}
              >
                <div className="p-2 rounded-lg bg-[#0e0e11] border border-[#d4af37]/25 flex-shrink-0">
                  {getStepIcon(step.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#f0e6d3] tracking-wide">
                      {step.label || step.title || `Step ${idx + 1}`}
                    </span>
                    {step.type && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#0a0a0c]/80 border border-[#d4af37]/25 text-[#e5c76b]">
                        {step.type}
                      </span>
                    )}
                  </div>

                  {step.description && (
                    <p className="text-[12px] text-[#c9bda2] mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  )}

                  {step.condition && (
                    <div className="mt-2 text-[11px] px-2.5 py-1 rounded-md bg-amber-950/40 border border-amber-500/30 text-amber-200/90">
                      ⚡ <strong>Condition:</strong> {step.condition}
                    </div>
                  )}
                </div>
              </div>

              {/* Flow Connector Arrow */}
              {!isLast && (
                <div className="flex flex-col items-center py-1.5 text-[#d4af37]/70">
                  <div className="w-0.5 h-3 bg-gradient-to-b from-[#d4af37]/60 to-[#d4af37]/20" />
                  <ArrowDown className="w-4 h-4 -my-1 text-[#e5c76b]" />
                  <div className="w-0.5 h-2 bg-[#d4af37]/20" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
