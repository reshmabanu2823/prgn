import { useState } from 'react'
import { BarChart3, LineChart, PieChart, Info } from 'lucide-react'

export default function ChartRenderer({ data }) {
  const chartType = (data?.chartType || data?.type || 'bar').toLowerCase()
  const labels = Array.isArray(data?.labels) ? data.labels : []
  const datasets = Array.isArray(data?.datasets)
    ? data.datasets
    : Array.isArray(data?.series)
    ? data.series
    : [{ label: 'Data', values: Array.isArray(data?.values) ? data.values : [] }]

  const [activeIdx, setActiveIdx] = useState(null)

  // Calculate max value for auto scaling
  const allValues = datasets.flatMap((d) => (Array.isArray(d.values) ? d.values : []))
  const maxVal = Math.max(...allValues, 1)

  // Color palette: Obsidian Gold variants
  const palette = [
    '#F2D06B', // Vibrant Gold
    '#D4AF37', // Metallic Gold
    '#A3862C', // Deep Antique Gold
    '#E5B84B', // Warm Amber Gold
    '#C49A32', // Muted Gold
  ]

  // Render Bar Chart
  const renderBarChart = () => {
    return (
      <div className="w-full flex flex-col gap-4">
        <div className="flex items-end gap-3 h-48 pt-6 pb-2 px-3 border-b border-l border-[#D4AF37]/30 bg-black/40 rounded-lg">
          {labels.map((label, idx) => {
            const firstSet = datasets[0]
            const val = firstSet?.values?.[idx] ?? 0
            const heightPercent = Math.max(8, Math.min(100, (val / maxVal) * 100))
            const isHovered = activeIdx === idx

            return (
              <div
                key={idx}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute -top-9 px-2 py-1 bg-black/90 border border-[#D4AF37] rounded text-[11px] text-[#F2D06B] font-mono shadow-lg whitespace-nowrap z-10 animate-fadeIn">
                    {firstSet?.label ? `${firstSet.label}: ` : ''}{val}
                  </div>
                )}

                {/* Bar */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full max-w-[40px] rounded-t-md transition-all duration-300 ${
                    isHovered
                      ? 'bg-gradient-to-t from-[#D4AF37] to-[#F2D06B] shadow-[0_0_15px_rgba(212,175,55,0.4)] scale-y-105'
                      : 'bg-gradient-to-t from-[#A3862C]/60 to-[#D4AF37]/80 hover:brightness-125'
                  }`}
                />
              </div>
            )
          })}
        </div>

        {/* X-Axis Labels */}
        <div className="flex justify-between px-3 text-[11px] text-white/60 font-medium">
          {labels.map((label, idx) => (
            <div
              key={idx}
              className={`flex-1 text-center truncate ${activeIdx === idx ? 'text-[#F2D06B] font-bold' : ''}`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Render Donut / Pie Chart
  const renderDonutChart = () => {
    const dataset = datasets[0] || { values: [] }
    const values = dataset.values || []
    const total = values.reduce((sum, v) => sum + (Number(v) || 0), 0) || 1

    let cumulativeAngle = 0

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4">
        {/* SVG Donut */}
        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {values.map((val, idx) => {
              const fraction = (Number(val) || 0) / total
              const strokeDasharray = `${fraction * 251.2} 251.2`
              const strokeDashoffset = -cumulativeAngle * 251.2
              cumulativeAngle += fraction

              const isHovered = activeIdx === idx
              const color = palette[idx % palette.length]

              return (
                <circle
                  key={idx}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke={color}
                  strokeWidth={isHovered ? '18' : '14'}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseLeave={() => setActiveIdx(null)}
                  className="transition-all duration-200 cursor-pointer"
                />
              )
            })}
          </svg>
          <div className="absolute flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-white/50">Total</span>
            <span className="text-sm font-bold text-[#F2D06B]">{total}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2">
          {labels.map((label, idx) => {
            const val = values[idx] ?? 0
            const pct = Math.round(((Number(val) || 0) / total) * 100)
            const isHovered = activeIdx === idx

            return (
              <div
                key={idx}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                className={`flex items-center gap-2.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  isHovered ? 'bg-[#D4AF37]/15' : 'hover:bg-white/5'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: palette[idx % palette.length] }}
                />
                <span className="text-xs text-white/80 font-medium">{label}</span>
                <span className="text-xs font-mono text-[#F2D06B] ml-auto font-semibold">
                  {val} ({pct}%)
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Render Line Chart
  const renderLineChart = () => {
    const dataset = datasets[0] || { values: [] }
    const values = dataset.values || []
    const count = values.length
    if (count < 2) return renderBarChart()

    const stepX = 260 / (count - 1)
    const points = values
      .map((v, i) => {
        const y = 90 - (Number(v) / maxVal) * 75
        return `${20 + i * stepX},${y}`
      })
      .join(' ')

    return (
      <div className="w-full flex flex-col gap-3">
        <div className="w-full bg-black/40 rounded-lg p-2 border border-[#D4AF37]/20">
          <svg viewBox="0 0 300 110" className="w-full h-44 overflow-visible">
            {/* Grid lines */}
            <line x1="20" y1="15" x2="280" y2="15" stroke="rgba(212,175,55,0.15)" strokeDasharray="3 3" />
            <line x1="20" y1="52" x2="280" y2="52" stroke="rgba(212,175,55,0.15)" strokeDasharray="3 3" />
            <line x1="20" y1="90" x2="280" y2="90" stroke="rgba(212,175,55,0.3)" />

            {/* Polyline */}
            <polyline
              fill="none"
              stroke="#D4AF37"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />

            {/* Data Dots */}
            {values.map((v, idx) => {
              const x = 20 + idx * stepX
              const y = 90 - (Number(v) / maxVal) * 75
              const isHovered = activeIdx === idx

              return (
                <g key={idx} className="cursor-pointer" onMouseEnter={() => setActiveIdx(idx)} onMouseLeave={() => setActiveIdx(null)}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 5.5 : 3.5}
                    fill="#F2D06B"
                    stroke="#0B0B0C"
                    strokeWidth="2"
                    className="transition-all"
                  />
                  {isHovered && (
                    <text x={x} y={y - 8} textAnchor="middle" fill="#F2D06B" fontSize="9" fontWeight="bold">
                      {v}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Labels */}
        <div className="flex justify-between px-4 text-[11px] text-white/60">
          {labels.map((l, idx) => (
            <span key={idx} className={activeIdx === idx ? 'text-[#F2D06B] font-bold' : ''}>
              {l}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-3 p-4 bg-black/40 rounded-xl border border-[#D4AF37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {chartType === 'donut' || chartType === 'pie'
        ? renderDonutChart()
        : chartType === 'line'
        ? renderLineChart()
        : renderBarChart()}
    </div>
  )
}
