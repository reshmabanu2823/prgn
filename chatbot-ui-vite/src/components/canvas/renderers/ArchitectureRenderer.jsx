import { Server, Layers, Cpu, Database, Cloud, Shield, ArrowDown } from 'lucide-react'

export default function ArchitectureRenderer({ data }) {
  const tiers = Array.isArray(data?.tiers)
    ? data.tiers
    : Array.isArray(data?.layers)
    ? data.layers
    : []

  const getTierIcon = (idx, name = '') => {
    const n = name.toLowerCase()
    if (n.includes('client') || n.includes('ui') || n.includes('frontend')) return <Layers className="w-4 h-4 text-[#F2D06B]" />
    if (n.includes('gateway') || n.includes('proxy') || n.includes('auth')) return <Shield className="w-4 h-4 text-amber-400" />
    if (n.includes('service') || n.includes('app') || n.includes('api')) return <Server className="w-4 h-4 text-emerald-400" />
    if (n.includes('data') || n.includes('db') || n.includes('storage') || n.includes('cache')) return <Database className="w-4 h-4 text-sky-400" />
    return <Cloud className="w-4 h-4 text-[#D4AF37]" />
  }

  return (
    <div className="w-full flex flex-col items-center gap-3 p-4 bg-black/40 rounded-xl border border-[#D4AF37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {tiers.map((tier, idx) => {
        const components = Array.isArray(tier.components)
          ? tier.components
          : Array.isArray(tier.nodes)
          ? tier.nodes
          : []
        const isLast = idx === tiers.length - 1

        return (
          <div key={idx} className="w-full flex flex-col items-center">
            {/* Tier Box */}
            <div className="w-full p-4 rounded-xl border border-[#D4AF37]/30 bg-black/60 shadow-md">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                {getTierIcon(idx, tier.name)}
                <span className="text-xs font-bold text-[#F2D06B] uppercase tracking-wider">
                  {tier.name || `Tier ${idx + 1}`}
                </span>
                {tier.protocol && (
                  <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/50">
                    {tier.protocol}
                  </span>
                )}
              </div>

              {/* Components in Tier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {components.map((comp, cIdx) => {
                  const name = typeof comp === 'string' ? comp : (comp.name || comp.title || 'Component')
                  const tech = typeof comp === 'object' ? comp.tech : null
                  const desc = typeof comp === 'object' ? comp.desc || comp.description : null

                  return (
                    <div
                      key={cIdx}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 hover:border-[#D4AF37]/60 hover:bg-[#D4AF37]/5 transition-all duration-150 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-semibold text-white/95">{name}</span>
                      </div>

                      {tech && (
                        <span className="text-[10.5px] font-mono text-[#F2D06B] font-medium">
                          {tech}
                        </span>
                      )}

                      {desc && (
                        <p className="text-[11px] text-white/50 leading-relaxed mt-0.5">{desc}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Protocol Arrow between tiers */}
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
  )
}
