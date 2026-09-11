import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FileText, Sparkles } from 'lucide-react'

function TreeNode({ node, depth = 0, defaultExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const hasChildren = Array.isArray(node?.children) && node.children.length > 0

  const getDepthStyle = (d) => {
    switch (d) {
      case 0:
        return 'bg-gradient-to-r from-[#D4AF37]/25 to-[#D4AF37]/10 border-[#D4AF37]/50 text-[#F2D06B] font-bold shadow-[0_0_15px_rgba(212,175,55,0.2)]'
      case 1:
        return 'bg-black/70 border-[#D4AF37]/35 text-[#F2D06B] font-semibold'
      case 2:
        return 'bg-black/50 border-white/15 text-white/90 font-medium'
      default:
        return 'bg-black/30 border-white/10 text-white/75 font-normal'
    }
  }

  return (
    <div className="flex flex-col">
      <div
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        className={`group flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-150 select-none ${hasChildren ? 'cursor-pointer hover:border-[#D4AF37]/60' : 'cursor-default'} ${getDepthStyle(depth)}`}
      >
        {hasChildren ? (
          <button
            type="button"
            className="w-4 h-4 flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <div className="w-4 h-4 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/60" />
          </div>
        )}

        {depth === 0 ? (
          <Sparkles className="w-4 h-4 text-[#F2D06B]" />
        ) : hasChildren ? (
          <Folder className="w-3.5 h-3.5 text-[#D4AF37]/80" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-white/40" />
        )}

        <span className="text-xs tracking-wide flex-1">{node.label || node.name || 'Node'}</span>

        {node.tag && (
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#F2D06B]">
            {node.tag}
          </span>
        )}

        {node.description && (
          <span className="text-[11px] text-white/40 hidden sm:inline truncate max-w-xs">
            {node.description}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="pl-6 ml-3 my-1 border-l-2 border-[#D4AF37]/20 flex flex-col gap-1.5 animate-fadeIn">
          {node.children.map((child, idx) => (
            <TreeNode key={idx} node={child} depth={depth + 1} defaultExpanded={defaultExpanded} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TreeRenderer({ data }) {
  const rootNode = data?.label || data?.name ? data : (data?.root || data?.nodes?.[0] || { label: 'Root', children: [] })

  return (
    <div className="w-full flex flex-col gap-2 p-3 bg-black/40 rounded-xl border border-[#D4AF37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      <TreeNode node={rootNode} depth={0} defaultExpanded={true} />
    </div>
  )
}
