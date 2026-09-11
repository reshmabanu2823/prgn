import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2,
  Eye,
  Download,
  Copy,
  Check,
  X,
  Maximize2,
  Minimize2,
  FileOutput,
  RotateCw,
  Monitor,
  Tablet,
  Smartphone,
} from 'lucide-react'

function escapeHtml(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getFileExtension(lang, code = '') {
  const l = (lang || '').toLowerCase().trim()
  const extMap = {
    html: 'html',
    htm: 'html',
    svg: 'svg',
    javascript: 'js',
    js: 'js',
    jsx: 'jsx',
    typescript: 'ts',
    ts: 'ts',
    tsx: 'tsx',
    python: 'py',
    py: 'py',
    css: 'css',
    scss: 'scss',
    json: 'json',
    markdown: 'md',
    md: 'md',
    sql: 'sql',
    shell: 'sh',
    sh: 'sh',
    bash: 'sh',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    txt: 'txt',
  }
  if (extMap[l]) return extMap[l]
  if (code.trim().startsWith('<svg')) return 'svg'
  if (code.includes('<!DOCTYPE') || code.includes('<html')) return 'html'
  if (code.trim().startsWith('{') || code.trim().startsWith('[')) {
    try {
      JSON.parse(code)
      return 'json'
    } catch {}
  }
  return 'txt'
}

export default function ArtifactPanel({ artifact, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('preview') // 'preview' | 'code'
  const [isExpanded, setIsExpanded] = useState(false)
  const [viewportMode, setViewportMode] = useState('desktop') // 'desktop' | 'tablet' | 'mobile'
  const [copied, setCopied] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)

  const content = artifact?.content || ''
  const title = artifact?.title || 'Interactive Artifact'
  const rawLanguage = (artifact?.language || '').toLowerCase()
  const detectedExt = getFileExtension(rawLanguage, content)

  const isPreviewable =
    detectedExt === 'html' ||
    detectedExt === 'svg' ||
    detectedExt === 'md' ||
    content.includes('<html') ||
    content.includes('<!DOCTYPE') ||
    content.trim().startsWith('<svg')

  // Default to preview if previewable, otherwise code
  useEffect(() => {
    if (isPreviewable) {
      setActiveTab('preview')
    } else {
      setActiveTab('code')
    }
  }, [content, isPreviewable])

  if (!isOpen || !artifact) return null

  const handleCopyCode = () => {
    if (!content) return
    navigator.clipboard?.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!content) return
    const mimeMap = {
      html: 'text/html;charset=utf-8',
      svg: 'image/svg+xml;charset=utf-8',
      json: 'application/json;charset=utf-8',
      md: 'text/markdown;charset=utf-8',
      js: 'text/javascript;charset=utf-8',
      jsx: 'text/javascript;charset=utf-8',
      ts: 'text/plain;charset=utf-8',
      tsx: 'text/plain;charset=utf-8',
      py: 'text/x-python;charset=utf-8',
      css: 'text/css;charset=utf-8',
      txt: 'text/plain;charset=utf-8',
    }
    const mimeType = mimeMap[detectedExt] || 'text/plain;charset=utf-8'
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeTitle =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'artifact'
    a.download = `${safeTitle}.${detectedExt}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportPdf = () => {
    if (!content) return
    const printFrame = document.createElement('iframe')
    printFrame.style.position = 'fixed'
    printFrame.style.right = '0'
    printFrame.style.bottom = '0'
    printFrame.style.width = '0'
    printFrame.style.height = '0'
    printFrame.style.border = '0'
    document.body.appendChild(printFrame)

    const cleanup = () => {
      if (printFrame.parentNode) document.body.removeChild(printFrame)
    }

    const doc = printFrame.contentWindow?.document
    if (!doc) {
      cleanup()
      return
    }

    doc.open()
    if (detectedExt === 'html') {
      doc.write(content)
    } else if (detectedExt === 'svg') {
      doc.write(`<!doctype html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 15mm; }
    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>${content}</body>
</html>`)
    } else {
      doc.write(`<!doctype html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 20mm; }
    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      white-space: pre-wrap;
      word-break: break-word;
      padding: 24px;
      font-size: 12px;
      line-height: 1.6;
      color: #111;
      background: #fff;
    }
    h1 {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 18px;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 8px;
      margin-bottom: 18px;
      color: #000;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${escapeHtml(content)}
</body>
</html>`)
    }
    doc.close()

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus()
        printFrame.contentWindow?.print()
      } catch (e) {
        console.error('Print preview failed:', e)
      }
      setTimeout(cleanup, 1200)
    }, 300)
  }

  // Generate preview document
  const getPreviewSrcDoc = () => {
    if (detectedExt === 'svg' || content.trim().startsWith('<svg')) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      padding: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0d0d12;
      background-image: radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px);
      background-size: 20px 20px;
      box-sizing: border-box;
    }
    svg {
      max-width: 100%;
      max-height: 85vh;
      filter: drop-shadow(0 12px 28px rgba(0,0,0,0.45));
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`
    }

    if (detectedExt === 'html') {
      if (!content.includes('<html') && !content.includes('<!DOCTYPE')) {
        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #1a1a1e;
      background: #ffffff;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`
      }
      return content
    }

    if (detectedExt === 'md') {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 32px;
      max-width: 780px;
      margin: 0 auto;
      color: #1f2328;
      background: #ffffff;
      line-height: 1.65;
    }
    pre { background: #f6f8fa; padding: 16px; border-radius: 8px; overflow: auto; }
    code { font-family: monospace; font-size: 13px; }
  </style>
</head>
<body>
  <pre style="white-space: pre-wrap; font-family: inherit; background: transparent; padding: 0;">${escapeHtml(content)}</pre>
</body>
</html>`
    }

    // Default preformatted fallback
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      margin: 0;
      padding: 24px;
      color: #f0f0f5;
      background: #0f0f13;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 13px;
      line-height: 1.6;
    }
  </style>
</head>
<body>${escapeHtml(content)}</body>
</html>`
  }

  // Line & character count
  const lineCount = content ? content.split('\n').length : 0
  const charCount = content ? content.length : 0

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop on mobile or when fullscreen */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 bg-black/40 backdrop-blur-xs ${isExpanded ? 'z-55' : 'z-40 lg:hidden'}`}
            onClick={isExpanded ? () => setIsExpanded(false) : onClose}
          />

          {/* Split-View / Fullscreen Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: isExpanded ? '100vw' : '52vw',
              maxWidth: isExpanded ? '100vw' : '820px',
              minWidth: isExpanded ? '100vw' : '340px',
              zIndex: isExpanded ? 60 : 50,
              background: 'var(--pragna-surface, #101014)',
              borderLeft: '1px solid var(--pragna-border, rgba(255,255,255,0.08))',
              boxShadow: '-12px 0 36px rgba(0,0,0,0.55)',
              display: 'flex',
              flexDirection: 'column',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderBottom: '1px solid var(--pragna-border, rgba(255,255,255,0.08))',
                background: 'rgba(16, 16, 20, 0.95)',
                gap: '12px',
                flexShrink: 0,
              }}
            >
              {/* Left: Icon, Title & Meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: 'rgba(212, 175, 55, 0.15)',
                    border: '1px solid rgba(212, 175, 55, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--pragna-gold, #d4af37)',
                    flexShrink: 0,
                  }}
                >
                  <Code2 size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        fontWeight: 650,
                        color: 'var(--pragna-text, #f5f5f7)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={title}
                    >
                      {title}
                    </h3>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '1.5px 6px',
                        borderRadius: '4px',
                        background: 'rgba(212, 175, 55, 0.16)',
                        color: 'var(--pragna-gold, #d4af37)',
                        border: '1px solid rgba(212, 175, 55, 0.25)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {detectedExt.toUpperCase()}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--pragna-text-muted, #8e8e93)',
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>{lineCount} lines</span>
                    <span>•</span>
                    <span>{(charCount / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {/* Tabs Segment */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '2.5px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    marginRight: '4px',
                  }}
                >
                  {isPreviewable && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('preview')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4.5px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: activeTab === 'preview' ? 650 : 500,
                        background: activeTab === 'preview' ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                        color: activeTab === 'preview' ? 'var(--pragna-gold, #d4af37)' : 'var(--pragna-text-muted, #8e8e93)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab('code')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4.5px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: activeTab === 'code' ? 650 : 500,
                      background: activeTab === 'code' ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                      color: activeTab === 'code' ? 'var(--pragna-gold, #d4af37)' : 'var(--pragna-text-muted, #8e8e93)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Code2 size={13} />
                    <span>Code</span>
                  </button>
                </div>

                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Copy code"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '7px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: copied ? 'var(--pragna-gold, #d4af37)' : 'var(--pragna-text-muted, #8e8e93)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>

                {/* Download Button */}
                <button
                  type="button"
                  onClick={handleDownload}
                  title={`Download as .${detectedExt}`}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '7px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: 'var(--pragna-text-muted, #8e8e93)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
                >
                  <Download size={14} />
                </button>

                {/* Export as PDF Button */}
                <button
                  type="button"
                  onClick={handleExportPdf}
                  title="Export to PDF"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '7px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: 'var(--pragna-text-muted, #8e8e93)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
                >
                  <FileOutput size={14} />
                </button>

                {/* Fullscreen Expander Button */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  title={isExpanded ? 'Exit Fullscreen' : 'Expand Fullscreen'}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '7px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: isExpanded ? 'var(--pragna-gold, #d4af37)' : 'var(--pragna-text-muted, #8e8e93)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
                >
                  {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  title="Close panel"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '7px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--pragna-text-muted, #8e8e93)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Subheader Toolbar for Preview Mode: Responsive Viewport Switcher & Reload */}
            {activeTab === 'preview' && isPreviewable && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 16px',
                  background: 'rgba(20, 20, 26, 0.85)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: '11.5px',
                  color: 'var(--pragna-text-muted, #8e8e93)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setViewportMode('desktop')}
                    title="Desktop View (100%)"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      border: 'none',
                      background: viewportMode === 'desktop' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      color: viewportMode === 'desktop' ? '#fff' : 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <Monitor size={12} />
                    <span>Desktop</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewportMode('tablet')}
                    title="Tablet View (768px)"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      border: 'none',
                      background: viewportMode === 'tablet' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      color: viewportMode === 'tablet' ? '#fff' : 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <Tablet size={12} />
                    <span>Tablet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewportMode('mobile')}
                    title="Mobile View (375px)"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      border: 'none',
                      background: viewportMode === 'mobile' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      color: viewportMode === 'mobile' ? '#fff' : 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <Smartphone size={12} />
                    <span>Mobile</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIframeKey((k) => k + 1)}
                  title="Reload Preview"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '5px',
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                  className="hover:text-white"
                >
                  <RotateCw size={12} />
                  <span>Reload</span>
                </button>
              </div>
            )}

            {/* Panel Body */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0b0b0f' }}>
              {activeTab === 'preview' && isPreviewable ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: viewportMode === 'desktop' ? '#ffffff' : '#08080a',
                    padding: viewportMode === 'desktop' ? 0 : '16px',
                    boxSizing: 'border-box',
                    overflow: 'auto',
                  }}
                >
                  <div
                    style={{
                      width:
                        viewportMode === 'mobile'
                          ? '375px'
                          : viewportMode === 'tablet'
                          ? '768px'
                          : '100%',
                      height: '100%',
                      maxWidth: '100%',
                      borderRadius: viewportMode === 'desktop' ? 0 : '12px',
                      overflow: 'hidden',
                      boxShadow: viewportMode === 'desktop' ? 'none' : '0 10px 30px rgba(0,0,0,0.6)',
                      border: viewportMode === 'desktop' ? 'none' : '1px solid rgba(255,255,255,0.12)',
                      background: '#ffffff',
                    }}
                  >
                    <iframe
                      key={iframeKey}
                      srcDoc={getPreviewSrcDoc()}
                      sandbox="allow-scripts allow-forms allow-popups"
                      title={title}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        background: '#ffffff',
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* Code View */
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#0e0e13',
                  }}
                >
                  {/* Code Body with Line Numbers */}
                  <div
                    style={{
                      flex: 1,
                      overflow: 'auto',
                      padding: '16px 20px',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '13px',
                      lineHeight: '1.65',
                      color: '#e6edf3',
                    }}
                    className="custom-scrollbar"
                  >
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      <code>{content}</code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
