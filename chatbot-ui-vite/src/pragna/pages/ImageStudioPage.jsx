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
  ChevronDownIcon,
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

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
  const [styleFilter, setStyleFilter] = useState('all')

  const PROMPT_SUGGESTIONS = [
    'A cyberpunk samurai in a rain-slicked neon Tokyo street, 8k cinematic reflections',
    'Ethereal floating islands in a pastel sunset sky with cascading waterfalls',
    'Hyperrealistic golden hour studio portrait of an astronaut with glowing helmet visor',
    'Majestic ancient dragon wrapped around a crystal mountain peak, volumetric fog',
  ]

  // Filter history by search query and style filter
  const filteredHistory = useMemo(() => {
    let list = history
    if (styleFilter !== 'all') {
      list = list.filter((item) => item.style && item.style.toLowerCase() === styleFilter.toLowerCase())
    }
    const q = historySearch.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (item) =>
        (item.prompt && item.prompt.toLowerCase().includes(q)) ||
        (item.effective_prompt && item.effective_prompt.toLowerCase().includes(q)) ||
        (item.style && item.style.toLowerCase().includes(q)) ||
        (item.provider && item.provider.toLowerCase().includes(q)) ||
        (item.model && item.model.toLowerCase().includes(q))
    )
  }, [history, historySearch, styleFilter])

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? '16px 12px 32px 12px' : '28px 32px 64px 32px',
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
          top: '-100px',
          right: '-100px',
          width: '650px',
          height: '650px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Top Header */}
      <div
        style={{
          maxWidth: '920px',
          margin: '0 auto 24px auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 2,
          position: 'relative',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.05))',
              border: '1px solid rgba(212,175,55,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--pragna-gold-soft)',
            }}
          >
            <ImagesIcon size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: 'var(--pragna-text)', letterSpacing: '-0.02em' }}>
              AI Image Studio
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--pragna-text-muted)', letterSpacing: '0.2px' }}>
              Generate, iterate, and curate studio-grade visual artwork
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {rateLimit && (
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                color: 'var(--pragna-gold-soft)',
                background: 'rgba(212, 175, 55, 0.08)',
                padding: '5px 12px',
                borderRadius: '20px',
                border: '1px solid rgba(212, 175, 55, 0.22)',
              }}
            >
              Limit: {rateLimit}/acct
            </span>
          )}

          {/* History Sidebar Drawer Toggle Button */}
          <button
            onClick={() => setHistoryDrawerOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '12px',
              border: '1px solid rgba(212, 175, 55, 0.35)',
              background: 'rgba(212, 175, 55, 0.08)',
              color: 'var(--pragna-gold-soft)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            className="hover:bg-[rgba(212,175,55,0.16)] hover:border-[var(--pragna-gold-soft)]"
            title="Open Creations History"
          >
            <ImagesIcon size={15} />
            <span>History</span>
            <span
              style={{
                fontSize: '11px',
                background: 'rgba(212, 175, 55, 0.25)',
                padding: '1px 7px',
                borderRadius: '10px',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              {history.length}
            </span>
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER: Creation Section */}
      <div
        style={{
          maxWidth: '920px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Creation Studio Card */}
        <div
          style={{
            padding: isMobile ? '20px 16px' : '28px 32px',
            borderRadius: '24px',
            background: 'linear-gradient(180deg, rgba(26, 23, 19, 0.85) 0%, rgba(16, 14, 11, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 60px -20px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          }}
        >
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'rgba(212, 175, 55, 0.12)',
                  border: '1px solid rgba(212, 175, 55, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--pragna-gold-soft)',
                }}
              >
                <SparklesIcon size={15} />
              </div>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--pragna-text)', letterSpacing: '0.01em' }}>
                Creation Studio
              </span>
            </div>
            {imagePrompt && (
              <button
                onClick={() => setImagePrompt('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--pragna-text-muted)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '3px 8px',
                }}
                className="hover:text-[var(--pragna-gold-soft)]"
              >
                Clear Prompt
              </button>
            )}
          </div>

          {/* Prompt Input Textarea */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Describe your vision in detail... e.g. A cybernetic samurai standing under a neon rain in futuristic Tokyo, cinematic lighting, 8k hyper-detailed reflections"
              rows="4"
              style={{
                width: '100%',
                resize: 'vertical',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                background: 'rgba(0, 0, 0, 0.35)',
                color: 'var(--pragna-text)',
                fontFamily: 'inherit',
                fontSize: isMobile ? '15px' : '14px',
                lineHeight: 1.55,
                padding: '14px 16px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(212, 175, 55, 0.5)'
                e.target.style.boxShadow = '0 0 0 3px rgba(212, 175, 55, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.09)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Quick Inspiration Prompts */}
          <div style={{ marginBottom: '22px' }}>
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--pragna-text-muted)', marginBottom: '8px', fontWeight: 500 }}>
              💡 Quick Inspiration Prompts:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '6px' }}>
              {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setImagePrompt(suggestion)}
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    color: 'var(--pragna-text-muted)',
                    fontSize: '11.5px',
                    lineHeight: 1.35,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:text-[var(--pragna-gold-soft)] hover:bg-[rgba(212,175,55,0.06)] hover:border-[rgba(212,175,55,0.2)]"
                  title={suggestion}
                >
                  • {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '24px' }}>
            {/* Artistic Style Chips */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--pragna-text-muted)', marginBottom: '8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                Artistic Style
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '8px' }}>
                {STYLE_OPTIONS.map((opt) => {
                  const isSelected = imageStyle === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setImageStyle(opt.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '10px',
                        border: isSelected ? '1px solid rgba(212, 175, 55, 0.55)' : '1px solid rgba(255, 255, 255, 0.06)',
                        background: isSelected ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255, 255, 255, 0.025)',
                        color: isSelected ? 'var(--pragna-gold-soft)' : 'var(--pragna-text-muted)',
                        fontSize: '12px',
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      className={isSelected ? '' : 'hover:text-[var(--pragna-text)] hover:bg-[rgba(255,255,255,0.05)]'}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Row with Aspect Ratio & Quality */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
              {/* Aspect Ratio */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--pragna-text-muted)', marginBottom: '8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  Aspect Ratio
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {SIZE_OPTIONS.map((opt) => {
                    const isSelected = imageSize === opt.value
                    const shortLabel = opt.value === '1024x1024' ? '1:1 Square' : opt.value === '1024x1536' ? '9:16 Portrait' : '16:9 Landscape'
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setImageSize(opt.value)}
                        style={{
                          padding: '8px 6px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid rgba(212, 175, 55, 0.55)' : '1px solid rgba(255, 255, 255, 0.06)',
                          background: isSelected ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255, 255, 255, 0.025)',
                          color: isSelected ? 'var(--pragna-gold-soft)' : 'var(--pragna-text-muted)',
                          fontSize: '11.5px',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        className={isSelected ? '' : 'hover:text-[var(--pragna-text)] hover:bg-[rgba(255,255,255,0.05)]'}
                      >
                        {shortLabel}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Render Quality */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--pragna-text-muted)', marginBottom: '8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  Render Quality
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {QUALITY_OPTIONS.map((opt) => {
                    const isSelected = imageQuality === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setImageQuality(opt.value)}
                        style={{
                          padding: '8px 6px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid rgba(212, 175, 55, 0.55)' : '1px solid rgba(255, 255, 255, 0.06)',
                          background: isSelected ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255, 255, 255, 0.025)',
                          color: isSelected ? 'var(--pragna-gold-soft)' : 'var(--pragna-text-muted)',
                          fontSize: '11.5px',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        className={isSelected ? '' : 'hover:text-[var(--pragna-text)] hover:bg-[rgba(255,255,255,0.05)]'}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
            <button
              onClick={onGenerate}
              disabled={isGeneratingImage || !imagePrompt.trim()}
              style={{
                flex: 1.5,
                padding: '13px 24px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #e5c56d 0%, #c49a37 100%)',
                color: '#12100C',
                fontSize: '14px',
                fontWeight: 700,
                cursor: (isGeneratingImage || !imagePrompt.trim()) ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 24px -4px rgba(212, 175, 55, 0.35)',
                transition: 'all 0.2s ease',
                opacity: (isGeneratingImage || !imagePrompt.trim()) ? 0.45 : 1,
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
                      width: '15px',
                      height: '15px',
                      border: '2px solid rgba(0,0,0,0.3)',
                      borderTopColor: '#12100C',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span>Crafting Visual Artwork...</span>
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
                padding: '13px 20px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.03)',
                color: 'var(--pragna-text-muted)',
                fontSize: '13px',
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
                marginTop: '16px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(180,60,60,0.12)',
                border: '1px solid rgba(220,110,100,0.3)',
                color: '#e8a598',
                fontSize: '13px',
                lineHeight: 1.4,
              }}
            >
              ⚠️ {imageError}
            </div>
          )}
        </div>

        {/* Active / Latest Creation Result Hero */}
        {generatedImage?.image && (
          <div
            style={{
              padding: isMobile ? '18px 16px' : '24px',
              borderRadius: '24px',
              background: 'linear-gradient(180deg, rgba(26, 23, 19, 0.85) 0%, rgba(16, 14, 11, 0.95) 100%)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 24px 50px -15px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--pragna-gold-soft)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Generated Artwork
                </span>
                <span style={{ fontSize: '11px', color: 'var(--pragna-text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px' }}>
                  {generatedImage.model || 'DALL-E 3'}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--pragna-text-muted)' }}>
                {formatTimestamp(generatedImage.created_at || Date.now())}
              </span>
            </div>

            <div
              style={{
                position: 'relative',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                maxHeight: '520px',
                background: '#0a0908',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => setSelectedImage(generatedImage)}
            >
              <img
                src={generatedImage.image}
                alt="Generated AI"
                style={{ width: '100%', maxHeight: '520px', objectFit: 'contain', display: 'block' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.35)',
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
                <SearchIcon size={16} /> Click to Expand Lightbox
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <a
                  href={generatedImage.image}
                  download={`pragna-art-${Date.now()}.png`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
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
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.03)',
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

              <button
                onClick={() => setHistoryDrawerOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'transparent',
                  color: 'var(--pragna-text-muted)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                className="hover:text-[var(--pragna-gold-soft)]"
              >
                <ImagesIcon size={14} />
                <span>View in History Drawer →</span>
              </button>
            </div>

            {generatedImage?.effective_prompt && (
              <div
                style={{
                  marginTop: '4px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: '12px',
                }}
              >
                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ fontWeight: 600, color: 'var(--pragna-gold-soft)', userSelect: 'none', outline: 'none' }}>
                    Prompt Details {generatedImage.effective_prompt !== imagePrompt ? '(Enhanced by AI)' : ''}
                  </summary>
                  <p style={{ marginTop: '8px', marginBottom: 0, lineHeight: 1.55, color: 'var(--pragna-text)', whiteSpace: 'pre-wrap', fontSize: '12.5px', opacity: 0.9 }}>
                    {generatedImage.effective_prompt}
                  </p>
                </details>
              </div>
            )}
          </div>
        )}
      </div>

      {/* HISTORY SLIDE-OVER SIDEBAR DRAWER */}
      {historyDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              zIndex: 50,
              animation: 'fadeIn 0.2s ease',
            }}
            onClick={() => setHistoryDrawerOpen(false)}
          />

          {/* Drawer Sidebar Panel */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: isMobile ? '100vw' : '440px',
              maxWidth: '100vw',
              background: '#14120E',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.8)',
              zIndex: 51,
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideLeft 0.25s ease',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--pragna-text)', letterSpacing: '-0.01em' }}>
                  Creations History
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--pragna-gold-soft)',
                    background: 'rgba(212, 175, 55, 0.1)',
                    border: '1px solid rgba(212, 175, 55, 0.25)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  {history.length}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={fetchHistory}
                  disabled={historyLoading}
                  title="Refresh creations"
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: 'var(--pragna-text-muted)',
                    cursor: historyLoading ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11.5px',
                  }}
                  className="hover:text-[var(--pragna-gold-soft)]"
                >
                  <div style={{ animation: historyLoading ? 'spin 1s linear infinite' : 'none', display: 'flex' }}>
                    <RetryIcon size={12} />
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
                        border: '1px solid rgba(220,110,100,0.25)',
                        background: 'rgba(180,60,60,0.08)',
                        color: '#e8a598',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11.5px',
                      }}
                    >
                      <TrashIcon size={12} />
                      <span>Clear</span>
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
                          border: '1px solid rgba(220,110,100,0.35)',
                          boxShadow: '0 12px 30px rgba(0,0,0,0.8)',
                          zIndex: 20,
                          fontSize: '12px',
                        }}
                      >
                        <p style={{ margin: '0 0 10px 0', color: '#e8a598', fontWeight: 500, lineHeight: 1.4 }}>
                          Clear all image history?
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setShowClearConfirm(false)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              background: 'transparent',
                              color: 'var(--pragna-text-muted)',
                              cursor: 'pointer',
                              fontSize: '11px',
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
                              fontSize: '11px',
                            }}
                          >
                            {isClearing ? 'Clearing...' : 'Clear'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setHistoryDrawerOpen(false)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'var(--pragna-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  className="hover:text-white"
                  title="Close Drawer"
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            </div>

            {/* Drawer Search & Filter Toolbar */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                  placeholder="Search prompts or styles..."
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(0, 0, 0, 0.35)',
                    color: 'var(--pragna-text)',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(212, 175, 55, 0.5)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
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

              {/* Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }} className="custom-scrollbar">
                {['all', 'cinematic', 'photo', 'illustration', 'concept_art', 'anime', 'digital_art', 'fantasy'].map((st) => {
                  const label = st === 'all' ? 'All' : st === 'photo' ? 'Photo' : st === 'concept_art' ? 'Concept' : st === 'digital_art' ? 'Digital' : st.charAt(0).toUpperCase() + st.slice(1)
                  const isSelected = styleFilter === st
                  return (
                    <button
                      key={st}
                      onClick={() => setStyleFilter(st)}
                      style={{
                        padding: '3px 9px',
                        borderRadius: '12px',
                        border: isSelected ? '1px solid rgba(212, 175, 55, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                        background: isSelected ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        color: isSelected ? 'var(--pragna-gold-soft)' : 'var(--pragna-text-muted)',
                        fontSize: '11px',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      className={isSelected ? '' : 'hover:text-[var(--pragna-text)]'}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Drawer Feed List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }} className="custom-scrollbar">
              {historyLoading && history.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', gap: '10px' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      border: '2px solid rgba(212,175,55,0.2)',
                      borderTopColor: 'var(--pragna-gold-soft)',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span style={{ fontSize: '12.5px', color: 'var(--pragna-text-muted)' }}>
                    Loading creations...
                  </span>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--pragna-text-muted)', fontSize: '13px' }}>
                  {historySearch || styleFilter !== 'all' ? 'No creations match your filter.' : 'No creations in history yet.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {filteredHistory.map((item) => {
                    const imgSource = item.image_url || item.image
                    const isItemCopied = copiedId === item.id
                    const isItemDeleting = deletingId === item.id

                    return (
                      <div
                        key={item.id || item.created_at}
                        style={{
                          borderRadius: '14px',
                          background: 'rgba(255, 255, 255, 0.025)',
                          border: '1px solid rgba(255, 255, 255, 0.07)',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'all 0.2s ease',
                        }}
                        className="hover:border-[var(--pragna-gold-soft)] group"
                      >
                        {/* Image Thumbnail with Overlay */}
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            paddingTop: '56%',
                            background: '#0a0908',
                            cursor: 'pointer',
                            overflow: 'hidden',
                          }}
                          onClick={() => {
                            setSelectedImage(item)
                          }}
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

                          {/* Top Badges */}
                          <div
                            style={{
                              position: 'absolute',
                              top: '6px',
                              left: '6px',
                              right: '6px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              pointerEvents: 'none',
                            }}
                          >
                            {item.style && (
                              <span
                                style={{
                                  fontSize: '9.5px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  color: '#fff',
                                  background: 'rgba(0,0,0,0.65)',
                                  backdropFilter: 'blur(6px)',
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                }}
                              >
                                {item.style}
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: '9px',
                                color: 'rgba(255,255,255,0.85)',
                                background: 'rgba(0,0,0,0.65)',
                                backdropFilter: 'blur(6px)',
                                padding: '2px 6px',
                                borderRadius: '5px',
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
                              padding: '8px',
                              gap: '6px',
                            }}
                            className="group-hover:opacity-100"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedImage(item)
                              }}
                              style={{
                                flex: 1,
                                padding: '5px 8px',
                                borderRadius: '6px',
                                background: 'rgba(255,255,255,0.15)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: '#fff',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                backdropFilter: 'blur(4px)',
                              }}
                            >
                              <SearchIcon size={11} /> View HD
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemix(item)
                                setHistoryDrawerOpen(false)
                              }}
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                background: 'linear-gradient(135deg, var(--pragna-gold-soft), var(--pragna-gold-deep))',
                                border: 'none',
                                color: '#12100C',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '3px',
                              }}
                            >
                              <ZapIcon size={11} /> Remix
                            </button>
                          </div>
                        </div>

                        {/* Card Content & Action Buttons */}
                        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: '11.5px',
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

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                onClick={() => handleCopyPrompt(item.id, item.effective_prompt || item.prompt)}
                                title="Copy Prompt"
                                style={{
                                  padding: '4px 6px',
                                  borderRadius: '5px',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  background: 'rgba(255, 255, 255, 0.02)',
                                  color: 'var(--pragna-text-muted)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '10.5px',
                                }}
                              >
                                {isItemCopied ? <CheckIcon size={10} color="var(--pragna-gold-soft)" /> : <CopyIcon size={10} />}
                              </button>

                              <a
                                href={imgSource}
                                download={`pragna-${item.id || Date.now()}.png`}
                                title="Download Artwork"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  padding: '4px 6px',
                                  borderRadius: '5px',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  background: 'rgba(255, 255, 255, 0.02)',
                                  color: 'var(--pragna-text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  textDecoration: 'none',
                                }}
                              >
                                <DownloadIcon size={10} />
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
                              <TrashIcon size={10} />
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
        </>
      )}

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
