import { Database, Key, Link2 } from 'lucide-react'

export default function ERDiagramRenderer({ data }) {
  const entities = Array.isArray(data?.entities)
    ? data.entities
    : Array.isArray(data?.tables)
    ? data.tables
    : []

  const relations = Array.isArray(data?.relations)
    ? data.relations
    : Array.isArray(data?.relationships)
    ? data.relationships
    : []

  return (
    <div className="w-full flex flex-col gap-5 p-4 bg-black/40 rounded-xl border border-[#D4AF37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entities.map((ent, idx) => {
          const fields = Array.isArray(ent.fields)
            ? ent.fields
            : Array.isArray(ent.columns)
            ? ent.columns
            : []

          return (
            <div
              key={ent.name || idx}
              className="flex flex-col rounded-xl border border-[#D4AF37]/30 bg-black/70 overflow-hidden shadow-lg hover:border-[#D4AF37]/60 transition-all duration-200"
            >
              {/* Table Header */}
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-[#D4AF37]/20 to-transparent border-b border-[#D4AF37]/30">
                <Database className="w-4 h-4 text-[#F2D06B]" />
                <span className="text-xs font-bold text-[#F2D06B] tracking-wide font-mono">
                  {ent.name || ent.tableName || `Table ${idx + 1}`}
                </span>
              </div>

              {/* Table Fields */}
              <div className="p-2 divide-y divide-white/5 font-mono text-[11px]">
                {fields.map((field, fIdx) => {
                  const name = typeof field === 'string' ? field : (field.name || field.column)
                  const type = typeof field === 'object' ? field.type : 'VARCHAR'
                  const key = typeof field === 'object' ? field.key : null

                  return (
                    <div
                      key={fIdx}
                      className="flex items-center justify-between py-1.5 px-2 hover:bg-white/5 rounded transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        {key === 'PK' ? (
                          <span className="px-1 py-0.2 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            PK
                          </span>
                        ) : key === 'FK' ? (
                          <span className="px-1 py-0.2 text-[9px] font-bold rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                            FK
                          </span>
                        ) : (
                          <span className="w-3" />
                        )}
                        <span className="text-white/90 font-medium">{name}</span>
                      </div>
                      <span className="text-white/40 text-[10px] uppercase">{type}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Relationships Summary */}
      {relations.length > 0 && (
        <div className="p-3 rounded-xl bg-black/60 border border-[#D4AF37]/20 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#F2D06B]">
            <Link2 className="w-3.5 h-3.5" />
            <span>Database Relationships</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {relations.map((rel, rIdx) => (
              <div
                key={rIdx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-mono text-white/90"
              >
                <span className="text-[#F2D06B] font-bold">{rel.from}</span>
                <span className="px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-[#D4AF37] font-sans">
                  {rel.type || '1:N'}
                </span>
                <span className="text-[#F2D06B] font-bold">{rel.to}</span>
                {rel.label && <span className="text-white/40 text-[11px] font-sans">({rel.label})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
