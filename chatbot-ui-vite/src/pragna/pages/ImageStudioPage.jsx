import { useState, useEffect, useCallback, useMemo } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import {
  getImageStudioConfig,
  getImageHistory,
  deleteImageHistoryItem,
  clearImageHistory,
} from '../../api/api'
import {
  ImagesIcon,
  DownloadIcon,
  SparklesIcon,
  SearchIcon,
  CopyIcon,
  CheckIcon,
  TrashIcon,
  RetryIcon,
  CloseIcon,
  ZapIcon,
} from '../components/PragnaIcon'

const STYLE_OPTIONS = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'photo', label: 'Photorealistic' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'concept_art', label: 'Concept Art' },
  { value: 'product', label: 'Product Shot' },
  { value: 'anime', label: 'Anime / Manga' },
  { value: 'digital_art', label: 'Digital Art' },
  { value: 'fantasy', label: 'Fantasy Landscape' },
]

const QUALITY_OPTIONS = [
  { value: 'hd', label: 'HD Quality' },
  { value: 'standard', label: 'Standard' },
  { value: 'draft', label: 'Draft / Fast' },
]

const SIZE_OPTIONS = [
  { value: '1024x1024', label: 'Square (1024x1024)' },
  { value: '1024x1536', label: 'Portrait (1024x1536)' },
  { value: '1536x1024', label: 'Landscape (1536x1024)' },
]

const formatTimestamp = (dateStr) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const now = new Date()
    const diffSec = Math.floor((now - d) / 1000)
    if (diffSec < 60) return 'Just now'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

const ImageStudioPage = ({
  imagePrompt,
  setImagePrompt,
  imageStyle,
  setImageStyle,
  imageQuality,
  setImageQuality,
  imageSize,
  setImageSize,
  isGeneratingImage,
  generatedImage,
  imageError,
  onGenerate,
  onSendToChat,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTabletOrMobile = useMediaQuery('(max-width: 1024px)')

  const [rateLimit, setRateLimit] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historySearch, setHistorySearch] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [isClearing, setIsClearing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Fetch config and history on mount
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await getImageHistory(50, 0)
      if (res && Array.isArray(res.history)) {
        setHistory(res.history)
      } else if (Array.isArray(res)) {
        setHistory(res)
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    getImageStudioConfig()
      .then((data) => {
        if (isMounted && data?.rate_limit) {
          setRateLimit(data.rate_limit)
        }
      })
      .catch(() => {})

    fetchHistory()

    return () => {
      isMounted = false
    }
  }, [fetchHistory])

  // Automatically refresh history when a new image is generated
  useEffect(() => {
    if (generatedImage?.image) {
      fetchHistory()
    }
  }, [generatedImage, fetchHistory])

  // Copy prompt helper
  const handleCopyPrompt = (id, promptText) => {
    if (!promptText) return
    navigator.clipboard.writeText(promptText)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Remix / Use Prompt in Studio controls
  const handleRemix = (item) => {
    if (item.prompt) setImagePrompt(item.prompt)
    if (item.style) setImageStyle(item.style)
    if (item.quality) setImageQuality(item.quality)
    if (item.size) setImageSize(item.size)

    if (selectedImage) {
      setSelectedImage(null)
    }

    // Scroll smoothly to studio top on mobile
    if (isTabletOrMobile) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Delete a single item
  const handleDeleteItem = async (e, id) => {
    e.stopPropagation()
    if (deletingId) return
    setDeletingId(id)
    try {
      const ok = await deleteImageHistoryItem(id)
      if (ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id))
        if (selectedImage?.id === id) {
          setSelectedImage(null)
        }
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  // Clear all history
  const handleClearAll = async () => {
    setIsClearing(true)
    try {
      const ok = await clearImageHistory()
      if (ok) {
        setHistory([])
        setSelectedImage(null)
        setShowClearConfirm(false)
      }
    } catch {
      // ignore
    } finally {
      setIsClearing(false)
    }
  }

  // Filter history by search query
  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    if (!q) return history
    return history.filter(
      (item) =>
        (item.prompt && item.prompt.toLowerCase().includes(q)) ||
        (item.effective_prompt && item.effective_prompt.toLowerCase().includes(q)) ||
        (item.style && item.style.toLowerCase().includes(q)) ||
        (item.provider && item.provider.toLowerCase().includes(q)) ||
        (item.model && item.model.toLowerCase().includes(q))
    )
  }, [history, historySearch])

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? '16px 12px 32px 12px' : '32px 40px 48px 40px',
        animation: 'fadeUp 0.35s ease',
        height: '100%',
        position: 'relative',
        background: 'var(--pragna-bg)',
      }}
      className="custom-scrollbar"
    >
      {/* Background ambient gold radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '-80px',
          right: '-80px',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.09) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Top Header tracking phrase */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          zIndex: 2,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.05))',
              border: '1px solid rgba(212,175,55,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--pragna-gold-soft)',
            }}
          >
            <ImagesIcon size={18} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? '22px' : '26px', fontWeight: 700, color: 'var(--pragna-text)', letterSpacing: '-0.02em' }}>
              Image Studio & Gallery
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: isMobile ? '9px' : '10.5px',
              letterSpacing: isMobile ? '1.5px' : '2.8px',
              fontWeight: 600,
              color: 'var(--pragna-text-muted)',
              opacity: 0.75,
              textTransform: 'uppercase',
              userSelect: 'none',
            }}
          >
            EXPLORE &nbsp; CREATE &nbsp; EVOLVE
          </span>
          <span style={{ color: 'var(--pragna-gold-soft)', opacity: 0.5, fontWeight: 300 }}>—</span>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isTabletOrMobile ? '1fr' : 'minmax(420px, 490px) minmax(460px, 1fr)',
          gap: '28px',
          alignItems: 'start',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* LEFT COLUMN: Generation Studio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              padding: isMobile ? '18px 16px' : '24px',
              borderRadius: '20px',
              background: 'rgba(18, 16, 12, 0.85)',
              border: '1.5px solid rgba(212, 175, 55, 0.28)',
              backdropFilter: 'blur(14px)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(212, 175, 55, 0.08)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SparklesIcon size={16} color="var(--pragna-gold-soft)" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--pragna-text)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  Create New Artwork
                </span>
              </div>
              {rateLimit && (
                <span style={{ fontSize: '11.5px', color: 'var(--pragna-text-muted)', background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Limit: {rateLimit}/acct
                </span>
              )}
            </div>

            {/* Prompt textarea */}
            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe your vision in detail. Example: A futuristic cyberpunk samurai standing on a neon-lit rain-slicked Tokyo street, hyper-detailed reflections, cinematic 8k lighting..."
                rows="4"
                style={{
                  width: '100%',
                  resize: 'vertical',
                  borderRadius: '12px',
                  border: '1px solid var(--pragna-border)',
                  background: 'var(--pragna-surface)',
                  color: 'var(--pragna-text)',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  padding: '12px 14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--pragna-gold-soft)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--pragna-border)')}
              />
            </div>

            {/* Controls Selects */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--pragna-text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Style
                </label>
                <select
                  value={imageStyle}
                  onChange={(e) => setImageStyle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    borderRadius: '10px',
                    border: '1px solid var(--pragna-border)',
                    background: 'var(--pragna-surface)',
                    color: 'var(--pragna-text)',
                    fontFamily: 'inherit',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {STYLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--pragna-text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Quality
                </label>
                <select
                  value={imageQuality}
                  onChange={(e) => setImageQuality(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    borderRadius: '10px',
                    border: '1px solid var(--pragna-border)',
                    background: 'var(--pragna-surface)',
                    color: 'var(--pragna-text)',
                    fontFamily: 'inherit',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {QUALITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--pragna-text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Aspect Ratio
                </label>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    borderRadius: '10px',
                    border: '1px solid var(--pragna-border)',
                    background: 'var(--pragna-surface)',
                    color: 'var(--pragna-text)',
                    fontFamily: 'inherit',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {SIZE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
              <button
                onClick={onGenerate}
                disabled={isGeneratingImage || !imagePrompt.trim()}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  borderRadius: '11px',
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--pragna-gold-soft), var(--pragna-gold-deep))',
                  color: 'var(--pragna-bg)',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: (isGeneratingImage || !imagePrompt.trim()) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.3), 0 0 14px rgba(212,175,55,0.22)',
                  transition: 'all 0.2s ease',
                  opacity: (isGeneratingImage || !imagePrompt.trim()) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isGeneratingImage ? (
                  <>
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(0,0,0,0.3)',
                        borderTopColor: '#12100C',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <span>Crafting Image...</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon size={16} />
                    <span>Generate Artwork</span>
                  </>
                )}
              </button>

              <button
                onClick={onSendToChat}
                style={{
                  padding: '12px 16px',
                  borderRadius: '11px',
                  border: '1px solid var(--pragna-border)',
                  background: 'transparent',
                  color: 'var(--pragna-text-muted)',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
                className="hover:text-[var(--pragna-gold-soft)] hover:border-accent-500/40"
              >
                Send to Chat
              </button>
            </div>

            {/* Error Message */}
            {imageError && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(180,60,60,0.15)',
                  border: '1px solid rgba(220,110,100,0.35)',
                  color: '#e8a598',
                  fontSize: '13px',
                  lineHeight: 1.4,
                }}
              >
                ⚠️ {imageError}
              </div>
            )}
          </div>

          {/* Active / Latest Generated Preview */}
          {generatedImage?.image && (
            <div
              style={{
                padding: '18px',
                borderRadius: '18px',
                background: 'rgba(18, 16, 12, 0.75)',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--pragna-gold-soft)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Latest Result
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--pragna-text-muted)' }}>
                  {generatedImage.model || 'DALL-E 3'}
                </span>
              </div>

              <div
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid var(--pragna-border)',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedImage(generatedImage)}
              >
                <img
                  src={generatedImage.image}
                  alt="Generated AI"
                  style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.3)',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    gap: '6px',
                  }}
                  className="hover:opacity-100"
                >
                  <SearchIcon size={16} /> Click to Expand
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <a
                  href={generatedImage.image}
                  download={`pragna-art-${Date.now()}.png`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(212,175,55,0.35)',
                    background: 'rgba(212,175,55,0.08)',
                    textDecoration: 'none',
                    color: 'var(--pragna-gold-soft)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                  }}
                >
                  <DownloadIcon size={14} /> Download High-Res
                </a>

                <button
                  onClick={() => handleCopyPrompt('latest', generatedImage.effective_prompt || imagePrompt)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--pragna-border)',
                    background: 'transparent',
                    color: 'var(--pragna-text-muted)',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {copiedId === 'latest' ? <CheckIcon size={13} color="var(--pragna-gold-soft)" /> : <CopyIcon size={13} />}
                  <span>{copiedId === 'latest' ? 'Copied' : 'Copy Prompt'}</span>
                </button>
              </div>

              {generatedImage?.effective_prompt && (
                <div
                  style={{
                    marginTop: '2px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'var(--pragna-surface-2, rgba(255,255,255,0.03))',
                    border: '1px solid var(--pragna-border)',
                    fontSize: '12px',
                  }}
                >
                  <details style={{ cursor: 'pointer' }}>
                    <summary style={{ fontWeight: 600, color: 'var(--pragna-gold-soft)', userSelect: 'none', outline: 'none' }}>
                      Prompt used {generatedImage.effective_prompt !== imagePrompt ? '(LLM Enhanced)' : ''}
                    </summary>
                    <p style={{ marginTop: '6px', marginBottom: 0, lineHeight: 1.5, color: 'var(--pragna-text)', whiteSpace: 'pre-wrap', fontSize: '12px', opacity: 0.9 }}>
                      {generatedImage.effective_prompt}
                    </p>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: User History Activity Section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: 'rgba(18, 16, 12, 0.75)',
            borderRadius: '20px',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            padding: isMobile ? '16px' : '22px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            minHeight: '480px',
          }}
        >
          {/* History Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--pragna-text)', letterSpacing: '-0.01em' }}>
                Generation History
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--pragna-gold-soft)',
                  background: 'rgba(212,175,55,0.12)',
                  border: '1px solid rgba(212,175,55,0.28)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {history.length} {history.length === 1 ? 'artwork' : 'artworks'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={fetchHistory}
                disabled={historyLoading}
                title="Refresh history"
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--pragna-border)',
                  background: 'transparent',
                  color: 'var(--pragna-text-muted)',
                  cursor: historyLoading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                }}
                className="hover:text-[var(--pragna-gold-soft)]"
              >
                <div style={{ animation: historyLoading ? 'spin 1s linear infinite' : 'none', display: 'flex' }}>
                  <RetryIcon size={13} />
                </div>
                <span>Refresh</span>
              </button>

              {history.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowClearConfirm((v) => !v)}
                    disabled={isClearing}
                    title="Clear history"
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(220,110,100,0.3)',
                      background: 'rgba(180,60,60,0.08)',
                      color: '#e8a598',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                    }}
                  >
                    <TrashIcon size={13} />
                    <span>Clear All</span>
                  </button>

                  {showClearConfirm && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        width: '220px',
                        padding: '12px',
                        borderRadius: '12px',
                        background: '#1A1815',
                        border: '1px solid rgba(220,110,100,0.4)',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.7)',
                        zIndex: 20,
                        fontSize: '12px',
                      }}
                    >
                      <p style={{ margin: '0 0 10px 0', color: '#e8a598', fontWeight: 500, lineHeight: 1.4 }}>
                        Clear all your image history? This action cannot be undone.
                      </p>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--pragna-border)',
                            background: 'transparent',
                            color: 'var(--pragna-text-muted)',
                            cursor: 'pointer',
                            fontSize: '11.5px',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleClearAll}
                          disabled={isClearing}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#c24136',
                            color: '#fff',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '11.5px',
                          }}
                        >
                          {isClearing ? 'Clearing...' : 'Yes, Clear'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Search bar */}
          {history.length > 0 && (
            <div style={{ position: 'relative' }}>
              <SearchIcon
                size={14}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--pragna-text-muted)',
                }}
              />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search past prompts, styles, or models..."
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  borderRadius: '10px',
                  border: '1px solid var(--pragna-border)',
                  background: 'var(--pragna-surface)',
                  color: 'var(--pragna-text)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {historySearch && (
                <button
                  onClick={() => setHistorySearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--pragna-text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                >
                  <CloseIcon size={12} />
                </button>
              )}
            </div>
          )}

          {/* History Gallery Body */}
          {historyLoading && history.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', gap: '12px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  border: '2px solid rgba(212,175,55,0.2)',
                  borderTopColor: 'var(--pragna-gold-soft)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span style={{ fontSize: '13px', color: 'var(--pragna-text-muted)' }}>
                Loading your creations...
              </span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 20px',
                textAlign: 'center',
                gap: '12px',
                borderRadius: '14px',
                border: '1px dashed rgba(212,175,55,0.18)',
                background: 'rgba(255,255,255,0.015)',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(212,175,55,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--pragna-gold-soft)',
                  opacity: 0.85,
                }}
              >
                <ImagesIcon size={24} />
              </div>
              <div style={{ maxWidth: '320px' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14.5px', fontWeight: 600, color: 'var(--pragna-text)' }}>
                  {historySearch ? 'No matching images found' : 'No image history yet'}
                </h4>
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--pragna-text-muted)', lineHeight: 1.5 }}>
                  {historySearch
                    ? 'Try adjusting your search keywords to find other generated artworks.'
                    : 'Artworks you generate will appear here automatically. You can remix prompts, preview in HD, or download anytime.'}
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: '14px',
                maxHeight: '680px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
              className="custom-scrollbar"
            >
              {filteredHistory.map((item) => {
                const imgSource = item.image_url || item.image
                const isItemCopied = copiedId === item.id
                const isItemDeleting = deletingId === item.id

                return (
                  <div
                    key={item.id || item.created_at}
                    style={{
                      borderRadius: '14px',
                      background: 'var(--pragna-surface)',
                      border: '1px solid rgba(212,175,55,0.18)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                      position: 'relative',
                    }}
                    className="hover:border-[var(--pragna-gold-soft)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.4),0_0_12px_rgba(212,175,55,0.15)] group"
                  >
                    {/* Thumbnail Image Container */}
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: '68%',
                        background: '#0a0908',
                        cursor: 'pointer',
                        overflow: 'hidden',
                      }}
                      onClick={() => setSelectedImage(item)}
                    >
                      <img
                        src={imgSource}
                        alt={item.prompt || 'Generated art'}
                        loading="lazy"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease',
                        }}
                        className="group-hover:scale-105"
                      />

                      {/* Top Overlay Badge for Style & Date */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          right: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          pointerEvents: 'none',
                        }}
                      >
                        {item.style && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: '#fff',
                              background: 'rgba(0,0,0,0.7)',
                              backdropFilter: 'blur(6px)',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.15)',
                            }}
                          >
                            {item.style}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '9.5px',
                            color: 'rgba(255,255,255,0.85)',
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(6px)',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            marginLeft: 'auto',
                          }}
                        >
                          {formatTimestamp(item.created_at)}
                        </span>
                      </div>

                      {/* Hover Action Overlay */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
                          opacity: 0,
                          transition: 'opacity 0.2s ease',
                          display: 'flex',
                          alignItems: 'flex-end',
                          padding: '10px',
                          gap: '6px',
                        }}
                        className="group-hover:opacity-100"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedImage(item)
                          }}
                          title="View High-Res"
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: 'rgba(255,255,255,0.15)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          <SearchIcon size={12} /> View
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemix(item)
                          }}
                          title="Remix prompt in Studio"
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, var(--pragna-gold-soft), var(--pragna-gold-deep))',
                            border: 'none',
                            color: '#12100C',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <ZapIcon size={12} /> Remix
                        </button>
                      </div>
                    </div>

                    {/* Card Meta Content */}
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'space-between' }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '12px',
                          color: 'var(--pragna-text)',
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                        }}
                        title={item.prompt}
                      >
                        {item.prompt}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={() => handleCopyPrompt(item.id, item.effective_prompt || item.prompt)}
                            title="Copy Prompt"
                            style={{
                              padding: '4px 6px',
                              borderRadius: '5px',
                              border: '1px solid var(--pragna-border)',
                              background: 'transparent',
                              color: 'var(--pragna-text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '11px',
                            }}
                          >
                            {isItemCopied ? <CheckIcon size={11} color="var(--pragna-gold-soft)" /> : <CopyIcon size={11} />}
                          </button>

                          <a
                            href={imgSource}
                            download={`pragna-${item.id || Date.now()}.png`}
                            title="Download Artwork"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              padding: '4px 6px',
                              borderRadius: '5px',
                              border: '1px solid var(--pragna-border)',
                              background: 'transparent',
                              color: 'var(--pragna-text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              textDecoration: 'none',
                            }}
                          >
                            <DownloadIcon size={11} />
                          </a>
                        </div>

                        <button
                          onClick={(e) => handleDeleteItem(e, item.id)}
                          disabled={isItemDeleting}
                          title="Delete Artwork"
                          style={{
                            padding: '4px 6px',
                            borderRadius: '5px',
                            border: 'none',
                            background: 'transparent',
                            color: 'rgba(220,110,100,0.6)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          className="hover:text-red-400"
                        >
                          <TrashIcon size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* FULL PREVIEW LIGHTBOX MODAL */}
      {selectedImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '12px' : '32px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '960px',
              width: '100%',
              maxHeight: '92vh',
              background: '#14120E',
              border: '1.5px solid rgba(212,175,55,0.3)',
              borderRadius: '20px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: isTabletOrMobile ? 'column' : 'row',
              boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Close Button */}
            <button
              onClick={() => setSelectedImage(null)}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                zIndex: 10,
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.65)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(8px)',
              }}
            >
              <CloseIcon size={15} />
            </button>

            {/* Left: High-Res Image View */}
            <div
              style={{
                flex: 1.3,
                background: '#080706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: isTabletOrMobile ? '280px' : '480px',
                padding: '16px',
              }}
            >
              <img
                src={selectedImage.image_url || selectedImage.image}
                alt={selectedImage.prompt || 'Artwork'}
                style={{
                  maxWidth: '100%',
                  maxHeight: isTabletOrMobile ? '40vh' : '75vh',
                  objectFit: 'contain',
                  borderRadius: '10px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                }}
              />
            </div>

            {/* Right: Detailed Metadata & Inspector */}
            <div
              style={{
                flex: 1,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                overflowY: 'auto',
                maxHeight: isTabletOrMobile ? '45vh' : '80vh',
              }}
              className="custom-scrollbar"
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'var(--pragna-gold-soft)',
                      letterSpacing: '1px',
                      background: 'rgba(212,175,55,0.12)',
                      padding: '3px 9px',
                      borderRadius: '8px',
                      border: '1px solid rgba(212,175,55,0.25)',
                    }}
                  >
                    {selectedImage.style || 'Custom Style'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--pragna-text-muted)' }}>
                    {formatTimestamp(selectedImage.created_at)}
                  </span>
                </div>

                <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 600, color: 'var(--pragna-text)', lineHeight: 1.4 }}>
                  Prompt Details
                </h3>

                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--pragna-text)', lineHeight: 1.55, background: 'var(--pragna-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--pragna-border)', whiteSpace: 'pre-wrap' }}>
                  {selectedImage.prompt}
                </p>

                {selectedImage.effective_prompt && selectedImage.effective_prompt !== selectedImage.prompt && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 600, color: 'var(--pragna-gold-soft)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      LLM-Refined Prompt
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--pragna-text-muted)', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {selectedImage.effective_prompt}
                    </p>
                  </div>
                )}

                {/* Specs / Meta Badges */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '11.5px', color: 'var(--pragna-text-muted)', marginBottom: '16px' }}>
                  <div style={{ background: 'var(--pragna-surface)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--pragna-border)' }}>
                    <span style={{ display: 'block', opacity: 0.6, fontSize: '10px', textTransform: 'uppercase' }}>Dimensions</span>
                    <strong style={{ color: 'var(--pragna-text)' }}>{selectedImage.size || '1024x1024'}</strong>
                  </div>
                  <div style={{ background: 'var(--pragna-surface)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--pragna-border)' }}>
                    <span style={{ display: 'block', opacity: 0.6, fontSize: '10px', textTransform: 'uppercase' }}>Model / Engine</span>
                    <strong style={{ color: 'var(--pragna-text)' }}>{selectedImage.model || selectedImage.provider || 'DALL-E 3'}</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons in Modal */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleRemix(selectedImage)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, var(--pragna-gold-soft), var(--pragna-gold-deep))',
                      color: 'var(--pragna-bg)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <ZapIcon size={14} /> Remix in Studio
                  </button>

                  <a
                    href={selectedImage.image_url || selectedImage.image}
                    download={`pragna-art-${selectedImage.id || Date.now()}.png`}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(212,175,55,0.3)',
                      background: 'rgba(212,175,55,0.08)',
                      color: 'var(--pragna-gold-soft)',
                      fontWeight: 600,
                      fontSize: '13px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <DownloadIcon size={14} /> Download
                  </a>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleCopyPrompt(selectedImage.id, selectedImage.effective_prompt || selectedImage.prompt)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--pragna-border)',
                      background: 'transparent',
                      color: 'var(--pragna-text-muted)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {copiedId === selectedImage.id ? <CheckIcon size={13} color="var(--pragna-gold-soft)" /> : <CopyIcon size={13} />}
                    <span>{copiedId === selectedImage.id ? 'Copied to Clipboard' : 'Copy Prompt'}</span>
                  </button>

                  {selectedImage.id && (
                    <button
                      onClick={(e) => handleDeleteItem(e, selectedImage.id)}
                      disabled={deletingId === selectedImage.id}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(220,110,100,0.3)',
                        background: 'transparent',
                        color: '#e8a598',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <TrashIcon size={13} />
                      <span>{deletingId === selectedImage.id ? 'Deleting...' : 'Delete'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageStudioPage
