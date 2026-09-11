import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FileText, Sparkles, Users, User, ArrowRight, LayoutGrid, ListTree } from 'lucide-react'

function TreeNode({ node, depth = 0, defaultExpanded = true, isHorizontal = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const hasChildren = Array.isArray(node?.children) && node.children.length > 0

  const getDepthStyle = (d) => {
    switch (d) {
      case 0:
        return 'bg-gradient-to-r from-[#D4AF37]/30 via-[#D4AF37]/15 to-black/80 border-[#D4AF37]/60 text-[#F2D06B] font-bold shadow-[0_0_20px_rgba(212,175,55,0.25)]'
      case 1:
        return 'bg-black/80 border-[#D4AF37]/40 text-[#F2D06B] font-semibold shadow-md'
      case 2:
        return 'bg-black/60 border-white/20 text-white/90 font-medium'
      default:
        return 'bg-black/40 border-white/10 text-white/80 font-normal'
    }
  }

  const isFamily = (node.label || '').toLowerCase().includes('grandparent') ||
    (node.label || '').toLowerCase().includes('parent') ||
    (node.label || '').toLowerCase().includes('father') ||
    (node.label || '').toLowerCase().includes('mother') ||
    (node.label || '').toLowerCase().includes('child') ||
    (node.label || '').toLowerCase().includes('cousin') ||
    (node.label || '').toLowerCase().includes('uncle')

  return (
    <div className="flex flex-col">
      <div
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        className={`group flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all duration-200 select-none ${
          hasChildren ? 'cursor-pointer hover:border-[#D4AF37]/80 hover:shadow-[0_0_12px_rgba(212,175,55,0.2)]' : 'cursor-default'
        } ${getDepthStyle(depth)}`}
      >
        {hasChildren ? (
          <button
            type="button"
            className="w-4 h-4 flex items-center justify-center text-[#D4AF37] group-hover:scale-125 transition-transform"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <div className="w-4 h-4 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/70" />
          </div>
        )}

        {depth === 0 ? (
          <Sparkles className="w-4 h-4 text-[#F2D06B] flex-shrink-0" />
        ) : isFamily ? (
          hasChildren ? <Users className="w-4 h-4 text-[#D4AF37] flex-shrink-0" /> : <User className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />
        ) : hasChildren ? (
          <Folder className="w-4 h-4 text-[#D4AF37]/80 flex-shrink-0" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
        )}

        <span className="text-xs tracking-wide flex-1 font-semibold">{node.label || node.name || 'Node'}</span>

        {node.tag && (
          <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#F2D06B]">
            {node.tag}
          </span>
        )}

        {node.description && (
          <span className="text-[11.5px] text-white/50 hidden sm:inline truncate max-w-xs">
            {node.description}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="pl-6 ml-3.5 my-1.5 border-l-2 border-[#D4AF37]/30 flex flex-col gap-2 animate-fadeIn">
          {node.children.map((child, idx) => (
            <TreeNode key={idx} node={child} depth={depth + 1} defaultExpanded={defaultExpanded} isHorizontal={isHorizontal} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TreeRenderer({ data }) {
  const [viewMode, setViewMode] = useState('tree') // 'tree' | 'generation'

  const rootNode = data?.label || data?.name ? data : (data?.root || data?.nodes?.[0] || { label: 'Root', children: [] })

  // Check if this is a generation / family tree
  const isFamilyTree = (rootNode.label || '').toLowerCase().includes('grandparent') ||
    (rootNode.children || []).some(c => (c.label || '').toLowerCase().includes('parent') || (c.label || '').toLowerCase().includes('uncle'))

  return (
    <div className="w-full flex flex-col gap-3 p-4 bg-black/40 rounded-xl border border-[#D4AF37]/25 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {/* View Switcher for Family Trees */}
      {isFamilyTree && (
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <span className="text-[11px] uppercase font-bold text-[#F2D06B] tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>Family Lineage Architecture</span>
          </span>
          <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-lg border border-white/10 text-xs">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'tree' ? 'bg-[#D4AF37]/20 text-[#F2D06B] font-bold border border-[#D4AF37]/40' : 'text-white/60 hover:text-white'
              }`}
            >
              <ListTree className="w-3 h-3" />
              <span>Hierarchy</span>
            </button>
            <button
              onClick={() => setViewMode('generation')}
              className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'generation' ? 'bg-[#D4AF37]/20 text-[#F2D06B] font-bold border border-[#D4AF37]/40' : 'text-white/60 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Generations</span>
            </button>
          </div>
        </div>
      )}

      {viewMode === 'generation' && isFamilyTree ? (
        /* Generation Tier View */
        <div className="flex flex-col gap-4 py-2">
          {/* Generation I */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-[#D4AF37]/20 to-black/60 border border-[#D4AF37]/40">
            <span className="text-[10px] uppercase font-bold text-[#F2D06B] tracking-widest">Generation I (Ancestors)</span>
            <div className="mt-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#F2D06B]" />
              <span className="text-sm font-bold text-white">{rootNode.label}</span>
            </div>
          </div>

          <div className="flex justify-center text-[#D4AF37]/60 -my-2">
            <span>↓</span>
          </div>

          {/* Generation II */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(rootNode.children || []).map((branch, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-black/70 border border-[#D4AF37]/35 flex flex-col gap-2">
                <span className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-wider">
                  Generation II • {branch.tag || 'Branch'}
                </span>
                <span className="text-xs font-bold text-white/95">{branch.label}</span>

                {/* Generation III */}
                {Array.isArray(branch.children) && branch.children.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1.5">
                    <span className="text-[9.5px] uppercase text-white/50 font-bold">Generation III (Offspring)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {branch.children.map((child, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2.5 py-1 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-medium text-[#F2D06B]"
                        >
                          {child.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Standard Interactive Hierarchy Tree */
        <TreeNode node={rootNode} depth={0} defaultExpanded={true} />
      )}
    </div>
  )
}
