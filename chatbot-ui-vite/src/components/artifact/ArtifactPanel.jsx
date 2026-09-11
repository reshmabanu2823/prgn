import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CodeIcon,
  EyeIcon,
  DownloadIcon,
  CopyIcon,
  CheckIcon,
  CloseIcon,
} from '../icons/PragnaIcon'

export default function ArtifactPanel({ artifact, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('preview') // 'preview' | 'code'
  const [copied, setCopied] = useState(false)

  if (!artifact) return null

  const title = artifact.title || 'HTML Web Artifact'
  const htmlContent = artifact.content || ''

  const handleDownload = () => {
    if (!htmlContent) return
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Create clean file name from title
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'artifact'
    a.download = `${safeTitle}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopyCode = () => {
    if (!htmlContent) return
    navigator.clipboard?.writeText(htmlContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 lg:hidden"
            onClick={onClose}
          />

          {/* Right Slide-in Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(720px, 100vw)',
              maxWidth: '100vw',
              zIndex: 50,
              background: 'var(--pragna-surface)',
              borderLeft: '1px solid var(--pragna-border)',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Panel Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--pragna-border)',
                background: 'rgba(20,18,12,0.85)',
              }}
            >
              {/* Title & Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '9px',
                    background: 'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.08))',
                    border: '1px solid rgba(212,175,55,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--pragna-gold-soft)',
                    flexShrink: 0,
                  }}
                >
                  <CodeIcon />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: 650,
                      color: 'var(--pragna-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {title}
                  </h3>
                  <div style={{ fontSize: '11.5px', color: 'var(--pragna-text-muted)', margin: '1px 0 0 0' }}>
                    HTML/CSS/JS Live Artifact
                  </div>
                </div>
              </div>

              {/* Action Buttons: Tabs, Download, Close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Tabs Segment */}
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--pragna-bg)',
                    padding: '3px',
                    borderRadius: '8px',
                    border: '1px solid var(--pragna-border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 11px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12.5px',
                      fontWeight: activeTab === 'preview' ? 650 : 500,
                      background: activeTab === 'preview' ? 'var(--pragna-surface-2)' : 'transparent',
                      color: activeTab === 'preview' ? 'var(--pragna-gold-soft)' : 'var(--pragna-text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <EyeIcon />
                    <span>Preview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('code')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 11px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12.5px',
                      fontWeight: activeTab === 'code' ? 650 : 500,
                      background: activeTab === 'code' ? 'var(--pragna-surface-2)' : 'transparent',
                      color: activeTab === 'code' ? 'var(--pragna-gold-soft)' : 'var(--pragna-text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <CodeIcon />
                    <span>Code</span>
                  </button>
                </div>

                {/* Download Button */}
                <button
                  type="button"
                  onClick={handleDownload}
                  title="Download HTML File"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(212,175,55,0.3)',
                    background: 'linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.06))',
                    color: 'var(--pragna-gold-soft)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  className="hover:scale-105 transition-transform"
                >
                  <DownloadIcon />
                  <span className="hidden sm:inline">Download</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  title="Close artifact panel"
                  style={{
                    padding: '7px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--pragna-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                  className="hover:bg-[var(--pragna-surface-2)] hover:text-white"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            {/* Panel Body Content */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0a0a0c' }}>
              {activeTab === 'preview' ? (
                /* MANDATORY SECURITY REQUIREMENT: sandbox="allow-scripts" */
                <iframe
                  srcDoc={htmlContent}
                  sandbox="allow-scripts"
                  title={title}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: '#ffffff',
                  }}
                />
              ) : (
                /* Code View */
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  {/* Copy Code Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 16px',
                      background: 'rgba(255,255,255,0.03)',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      fontSize: '12px',
                      color: 'var(--pragna-text-muted)',
                    }}
                  >
                    <span>HTML Source Code</span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'rgba(212,175,55,0.12)',
                        color: copied ? 'var(--pragna-gold-soft)' : '#d8cbb0',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                      className="hover:bg-[rgba(212,175,55,0.2)]"
                    >
                      {copied ? <CheckIcon /> : <CopyIcon />}
                      <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                  </div>

                  {/* Code Textarea / Pre */}
                  <div style={{ flex: 1, overflow: 'auto', padding: '16px' }} className="custom-scrollbar">
                    <pre
                      style={{
                        margin: 0,
                        fontFamily: 'Consolas, Monaco, "Fira Code", monospace',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        color: '#e6edf3',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      <code>{htmlContent}</code>
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
