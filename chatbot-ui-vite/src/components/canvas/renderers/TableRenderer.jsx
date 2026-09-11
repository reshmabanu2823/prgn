import { useState, useMemo } from 'react'
import { ArrowUpDown, Search, Download, Copy, Check } from 'lucide-react'

export default function TableRenderer({ data, title }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [copied, setCopied] = useState(false)

  const columns = useMemo(() => {
    if (data?.columns && Array.isArray(data.columns)) return data.columns
    if (Array.isArray(data?.rows) && data.rows.length > 0) {
      return Object.keys(data.rows[0])
    }
    return []
  }, [data])

  const rows = useMemo(() => {
    if (!Array.isArray(data?.rows)) return []
    let list = [...data.rows]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((r) =>
        Object.values(r).some((val) => String(val ?? '').toLowerCase().includes(q))
      )
    }

    if (sortKey) {
      list.sort((a, b) => {
        const valA = a[sortKey] ?? ''
        const valB = b[sortKey] ?? ''
        const numA = Number(valA)
        const numB = Number(valB)
        if (!isNaN(numA) && !isNaN(numB) && typeof valA !== 'boolean') {
          return sortDir === 'asc' ? numA - numB : numB - numA
        }
        return sortDir === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA))
      })
    }

    return list
  }, [data, search, sortKey, sortDir])

  const handleSort = (col) => {
    if (sortKey === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col)
      setSortDir('asc')
    }
  }

  const exportCSV = () => {
    if (!columns.length || !rows.length) return
    const headerLine = columns.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
    const rowLines = rows.map((r) =>
      columns.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')
    )
    const csvContent = 'data:text/csv;charset=utf-8,' + [headerLine, ...rowLines].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${(title || 'pragna_table').toLowerCase().replace(/\s+/g, '_')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyTSV = () => {
    if (!columns.length || !rows.length) return
    const headerLine = columns.join('\t')
    const rowLines = rows.map((r) => columns.map((c) => r[c] ?? '').join('\t'))
    const tsv = [headerLine, ...rowLines].join('\n')
    navigator.clipboard?.writeText(tsv)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-1">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#D4AF37]/60" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter table rows..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/40 border border-[#D4AF37]/20 rounded-lg text-white/90 placeholder-white/30 focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyTSV}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/30 rounded-lg text-[#F2D06B] transition-colors"
            title="Copy as TSV"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/30 rounded-lg text-[#F2D06B] transition-colors"
            title="Export as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-[#D4AF37]/25 bg-black/60 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-[#D4AF37]/20 via-[#D4AF37]/10 to-transparent border-b border-[#D4AF37]/30">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  onClick={() => handleSort(col)}
                  className="px-4 py-3 font-semibold text-[#F2D06B] tracking-wider uppercase cursor-pointer select-none hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col}</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortKey === col ? 'text-[#F2D06B]' : 'opacity-40'}`} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length > 0 ? (
              rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="hover:bg-[#D4AF37]/5 transition-colors group"
                >
                  {columns.map((col, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-4 py-2.5 text-white/80 group-hover:text-white transition-colors"
                    >
                      {typeof row[col] === 'boolean' ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${row[col] ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                          {row[col] ? 'Yes' : 'No'}
                        </span>
                      ) : (
                        String(row[col] ?? '—')
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length || 1} className="px-4 py-8 text-center text-white/40">
                  No matching records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-white/40 px-1 flex justify-between items-center">
        <span>Showing {rows.length} row{rows.length !== 1 ? 's' : ''}</span>
        <span>Click column header to sort</span>
      </div>
    </div>
  )
}
