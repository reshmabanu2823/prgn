import { useState, useMemo } from 'react'
import {
  Sparkles,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  Check,
  Download,
  Share2,
  Table,
  GitFork,
  Workflow,
  Network,
  Calendar,
  BarChart3,
  Columns3,
  Database,
  Server,
  Map,
  Layers,
  Wand2,
} from 'lucide-react'

import TableRenderer from './renderers/TableRenderer'
import TreeRenderer from './renderers/TreeRenderer'
import FlowchartRenderer from './renderers/FlowchartRenderer'
import MindmapRenderer from './renderers/MindmapRenderer'
import TimelineRenderer from './renderers/TimelineRenderer'
import ChartRenderer from './renderers/ChartRenderer'
import KanbanRenderer from './renderers/KanbanRenderer'
import ERDiagramRenderer from './renderers/ERDiagramRenderer'
import ArchitectureRenderer from './renderers/ArchitectureRenderer'
import RoadmapRenderer from './renderers/RoadmapRenderer'
import PragnaCanvasModal from './PragnaCanvasModal'
import AutopilotProgressCard from './AutopilotProgressCard'

export default function PragnaCanvas({ canvasData, onSendPrompt }) {
  const [zoom, setZoom] = useState(1)
  const [copied, setCopied] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showMorphMenu, setShowMorphMenu] = useState(false)

  // Parse canvas data if passed as string or JSON
  const parsed = useMemo(() => {
    if (!canvasData) return null
    if (typeof canvasData === 'object') return canvasData
    try {
      return JSON.parse(canvasData)
    } catch {
      return null
    }
  }, [canvasData])

  if (!parsed || !parsed.type) return null

  const type = (parsed.type || 'table').toLowerCase()
  const title = parsed.title || 'Interactive Visualization'
  const description = parsed.description || null
  const data = parsed.data || parsed

  const getTypeMeta = (t) => {
    switch (t) {
      case 'table':
        return { label: 'COMPARISON TABLE', icon: <Table className="w-4 h-4 text-[#F2D06B]" /> }
      case 'tree':
        return { label: 'CONCEPT TREE', icon: <GitFork className="w-4 h-4 text-[#F2D06B]" /> }
      case 'flowchart':
        return { label: 'PROCESS FLOWCHART', icon: <Workflow className="w-4 h-4 text-[#F2D06B]" /> }
      case 'mindmap':
        return { label: 'MIND MAP', icon: <Network className="w-4 h-4 text-[#F2D06B]" /> }
      case 'timeline':
        return { label: 'TIMELINE', icon: <Calendar className="w-4 h-4 text-[#F2D06B]" /> }
      case 'chart':
      case 'graph':
        return { label: 'DATA CHART', icon: <BarChart3 className="w-4 h-4 text-[#F2D06B]" /> }
      case 'kanban':
        return { label: 'KANBAN BOARD', icon: <Columns3 className="w-4 h-4 text-[#F2D06B]" /> }
      case 'er_diagram':
      case 'er':
        return { label: 'ER DIAGRAM', icon: <Database className="w-4 h-4 text-[#F2D06B]" /> }
      case 'system_architecture':
      case 'architecture':
        return { label: 'SYSTEM ARCHITECTURE', icon: <Server className="w-4 h-4 text-[#F2D06B]" /> }
      case 'roadmap':
        return { label: 'ROADMAP', icon: <Map className="w-4 h-4 text-[#F2D06B]" /> }
      default:
        return { label: 'PRAGNA CANVAS', icon: <Layers className="w-4 h-4 text-[#F2D06B]" /> }
    }
  }

  const meta = getTypeMeta(type)

  const handleCopyJSON = () => {
    navigator.clipboard?.writeText(JSON.stringify(parsed, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleZoomIn = () => setZoom((z) => Math.min(1.5, z + 0.1))
  const handleZoomOut = () => setZoom((z) => Math.max(0.7, z - 0.1))
  const handleResetZoom = () => setZoom(1)

  const handleMorph = (morphPrompt) => {
    setShowMorphMenu(false)
    if (onSendPrompt) {
      onSendPrompt(morphPrompt)
    }
  }

  const renderContent = () => {
    switch (type) {
      case 'table':
        return <TableRenderer data={data} title={title} />
      case 'tree':
        return <TreeRenderer data={data} />
      case 'flowchart':
        return <FlowchartRenderer data={data} />
      case 'mindmap':
        return <MindmapRenderer data={data} />
      case 'timeline':
        return <TimelineRenderer data={data} />
      case 'chart':
      case 'graph':
        return <ChartRenderer data={data} />
      case 'kanban':
        return <KanbanRenderer data={data} />
      case 'er_diagram':
      case 'er':
        return <ERDiagramRenderer data={data} />
      case 'system_architecture':
      case 'architecture':
        return <ArchitectureRenderer data={data} />
      case 'roadmap':
        return <RoadmapRenderer data={data} />
      default:
        return <TableRenderer data={data} title={title} />
    }
  }

  const isAutopilot = parsed.autopilot || parsed.mode === 'autopilot'

  return (
    <div className="w-full flex flex-col">
      {isAutopilot && (
        <AutopilotProgressCard
          isStreaming={false}
          onMakeItReal={() => setIsModalOpen(true)}
          onExpand={() => setIsModalOpen(true)}
          onEdit={() => onSendPrompt?.(`Update and refine the ${title} visualization: `)}
        />
      )}

      <div className="w-full my-3.5 rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-b from-[#18181B]/95 to-[#0B0B0C]/95 text-white/90 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-[#D4AF37]/60">
      {/* Canvas Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 bg-gradient-to-r from-[#D4AF37]/15 via-[#D4AF37]/5 to-transparent border-b border-[#D4AF37]/25">
        {/* Title & Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex-shrink-0">
            {meta.icon}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#F2D06B]">
                {meta.label}
              </span>
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide truncate">{title}</h3>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* MAKE IT REAL Action */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37]/30 to-[#F2D06B]/20 hover:from-[#D4AF37]/50 hover:to-[#F2D06B]/35 border border-[#D4AF37]/60 text-xs font-bold text-[#F2D06B] shadow-[0_0_15px_rgba(212,175,55,0.25)] hover:scale-105 transition-all duration-150"
            title="Open Interactive Canvas Studio"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#F2D06B] animate-pulse" />
            <span>✦ MAKE IT REAL</span>
          </button>

          {/* Zoom Controls for diagrams */}
          {['tree', 'mindmap', 'flowchart', 'architecture', 'er_diagram'].includes(type) && (
            <div className="hidden sm:flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-0.5">
              <button
                onClick={handleZoomOut}
                className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <button
                onClick={handleZoomIn}
                className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Morph Menu Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowMorphMenu(!showMorphMenu)}
              className="flex items-center gap-1 p-1.5 rounded-lg bg-black/40 hover:bg-[#D4AF37]/15 border border-white/10 hover:border-[#D4AF37]/40 text-white/70 hover:text-[#F2D06B] text-xs transition-colors"
              title="AI Response Morphing"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Morph</span>
            </button>

            {/* Morph Dropdown */}
            {showMorphMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-black/95 border border-[#D4AF37]/40 shadow-2xl p-1.5 z-50 flex flex-col gap-1 text-xs animate-fadeIn backdrop-blur-lg">
                <button
                  onClick={() =>
                    handleMorph(`Make this ${title} visualization significantly more detailed with deeper sub-nodes and technical specifics.`)
                  }
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-[#D4AF37]/15 text-white/90 hover:text-[#F2D06B] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#F2D06B]" />
                  <span>Make more detailed</span>
                </button>
                <button
                  onClick={() =>
                    handleMorph(`Simplify this ${title} visualization to focus on high-level key essentials.`)
                  }
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-[#D4AF37]/15 text-white/90 hover:text-[#F2D06B] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#F2D06B]" />
                  <span>Make simpler</span>
                </button>
                <button
                  onClick={() =>
                    handleMorph(`Transform this ${title} structure into a clean comparison table.`)
                  }
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-[#D4AF37]/15 text-white/90 hover:text-[#F2D06B] transition-colors"
                >
                  <Table className="w-3.5 h-3.5 text-[#F2D06B]" />
                  <span>Turn into Table</span>
                </button>
                <button
                  onClick={() =>
                    handleMorph(`Transform this structure into a system architecture diagram.`)
                  }
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-[#D4AF37]/15 text-white/90 hover:text-[#F2D06B] transition-colors"
                >
                  <Server className="w-3.5 h-3.5 text-[#F2D06B]" />
                  <span>Show Technical Architecture</span>
                </button>
                <button
                  onClick={() =>
                    handleMorph(`Transform this structure into a step-by-step process flowchart.`)
                  }
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-[#D4AF37]/15 text-white/90 hover:text-[#F2D06B] transition-colors"
                >
                  <Workflow className="w-3.5 h-3.5 text-[#F2D06B]" />
                  <span>Turn into Flowchart</span>
                </button>
              </div>
            )}
          </div>

          {/* Copy JSON */}
          <button
            onClick={handleCopyJSON}
            className="p-1.5 rounded-lg bg-black/40 hover:bg-[#D4AF37]/15 border border-white/10 hover:border-[#D4AF37]/40 text-white/70 hover:text-[#F2D06B] transition-colors"
            title="Copy Canvas JSON"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Optional Description */}
      {description && (
        <div className="px-4 pt-3 pb-1 text-xs text-white/60 leading-relaxed">
          {description}
        </div>
      )}

      {/* Canvas Body with interactive zoom */}
      <div className="p-4 overflow-x-auto">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          className="transition-transform duration-200"
        >
          {renderContent()}
        </div>
      </div>

      {/* Fullscreen Interactive Canvas Modal (MAKE IT REAL Studio) */}
      <PragnaCanvasModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        parsed={parsed}
        onSendPrompt={onSendPrompt}
      />
      </div>
    </div>
  )
}
