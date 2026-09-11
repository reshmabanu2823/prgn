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
        return <CheckCircle2 className="w-4 h-4 text-[#F2D06B]" />
      case 'decision':
        return <HelpCircle className="w-4 h-4 text-amber-400" />
      default:
        return <Activity className="w-4 h-4 text-[#D4AF37]" />
    }
  }

  const getStepBadge = (type) => {
    switch (type?.toLowerCase()) {
      case 'start':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
      case 'end':
        return 'bg-[#D4AF37]/20 border-[#D4AF37]/40 text-[#F2D06B]'
      case 'decision':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-300'
      default:
        return 'bg-black/60 border-[#D4AF37]/30 text-white/90'
    }
  }

  return (
    <div className="w-full flex flex-col gap-4 p-4 bg-black/40 rounded-xl border border-[#D4AF37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
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
                className={`w-full max-w-lg p-3.5 rounded-xl border transition-all duration-200 cursor-pointer select-none flex items-start gap-3 ${getStepBadge(step.type)} ${
                  isSelected ? 'ring-2 ring-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.25)]' : 'hover:border-[#D4AF37]/60'
                }`}
              >
                <div className="p-2 rounded-lg bg-black/40 border border-[#D4AF37]/20 flex-shrink-0">
                  {getStepIcon(step.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#F2D06B] tracking-wide">
                      {step.label || step.title || `Step ${idx + 1}`}
                    </span>
                    {step.type && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/50 border border-[#D4AF37]/20 text-[#D4AF37]">
                        {step.type}
                      </span>
                    )}
                  </div>

                  {step.description && (
                    <p className="text-[12px] text-white/70 mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  )}

                  {step.condition && (
                    <div className="mt-2 text-[11px] px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200">
                      ⚡ <strong>Condition:</strong> {step.condition}
                    </div>
                  )}
                </div>
              </div>

              {/* Flow Connector Arrow */}
              {!isLast && (
                <div className="flex flex-col items-center py-1.5 text-[#D4AF37]/70">
                  <div className="w-0.5 h-3 bg-gradient-to-b from-[#D4AF37]/60 to-[#D4AF37]/20" />
                  <ArrowDown className="w-4 h-4 -my-1 text-[#F2D06B]" />
                  <div className="w-0.5 h-2 bg-[#D4AF37]/20" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
