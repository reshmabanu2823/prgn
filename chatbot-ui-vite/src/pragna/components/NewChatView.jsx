import { useContext, useState, useRef, useEffect, useCallback } from 'react'
import { ChatContext } from '../../context/ChatContext'
import {
  generateAIImage,
  generateDocument,
  sendOrchestratedMessageStream,
  sendOrchestratedUploadMessage,
  sendOrchestratedMessage,
} from '../../api/api'
import { normalizeLanguageCode } from '../../utils/language'
import { useMediaQuery } from '../hooks/useMediaQuery'
import pragnaShield from '../../assets/pragna-shield-icon.png'
import {
  Paperclip,
  Mic,
  MicOff,
  ArrowUp,
  ChevronDown,
  BookOpen,
  PenLine,
  Search,
  Lightbulb,
  Code2,
  Image as ImageIcon,
  FileText,
  X,
  Check,
} from 'lucide-react'

const IMAGE_REQUEST_RE =
  /(create|generate|make|design)\s+(an?\s+)?(ai\s+)?image|image\s+of|illustration\s+of|poster\s+of|logo\s+of/i

const extractImagePrompt = (text) => {
  const raw = (text || '').trim()
  if (!raw) return ''
  return (
    raw
      .replace(
        /^(please\s+)?(create|generate|make|design)\s+(an?\s+)?(ai\s+)?(image|picture|photo|illustration)\s+(of|for)?\s*/i,
        ''
      )
      .trim() || raw
  )
}

const DOCUMENT_VERB_RE =
  /\b(create|generate|make|write|draft|build|export|give\s+me)\b.*\b(word(\s*(doc(ument)?|file))?|\bdocx\b|\bdoc(ument)?\b|report|excel(\s*(sheet|spreadsheet|file))?|spreadsheet|\bxlsx\b|\bpdf(\s*file)?\b|power\s*point(\s*(presentation|deck|file|slides?))?|presentation|slides?|\bpptx\b)\b/i

const DOCUMENT_FORMAT_PATTERNS = [
  { format: 'pptx', re: /power\s*point|presentation|slides?|\bpptx\b/i },
  { format: 'xlsx', re: /excel|spreadsheet|sheet|\bxlsx\b/i },
  { format: 'pdf', re: /\bpdf\b/i },
  { format: 'docx', re: /word(\s*(doc(ument)?|file))?|\bdoc(ument)?\b|\bdocx\b|report/i },
]

const extractDocumentRequest = (text) => {
  const raw = (text || '').trim()
  if (!raw || !DOCUMENT_VERB_RE.test(raw)) return null
  const match = DOCUMENT_FORMAT_PATTERNS.find((p) => p.re.test(raw))
  if (!match) return null
  const subject =
    raw
      .replace(
        /^(please\s+)?(create|generate|make|write|draft|build|export|give\s+me)\s+(me\s+)?(an?\s+)?(ms\s*)?((word(\s*(doc(ument)?|file))?|\bdocx\b|\bdoc(ument)?\b|excel(\s*(sheet|spreadsheet|file))?|spreadsheet|\bxlsx\b|pdf(\s*file)?|power\s*point(\s*(presentation|deck|file))?|presentation|slides?|\bpptx\b|report))\s*(about|on|for|regarding|with|containing|and|to|,)?\s*/i,
        ''
      )
      .trim() || raw
  return { format: match.format, subject }
}

const CHAT_MODES = [
  { id: 'general', label: 'General', icon: SparklesIcon },
  { id: 'explain_concepts', label: 'Explain', icon: BookOpen },
  { id: 'write_content', label: 'Write', icon: PenLine },
  { id: 'generate_ideas', label: 'Brainstorm', icon: Lightbulb },
  { id: 'code_assistance', label: 'Code', icon: Code2 },
  { id: 'ask_questions', label: 'Questions', icon: Search },
  { id: 'creative_writing', label: 'Story', icon: PenLine },
]

function SparklesIcon(props) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  )
}

const QUICK_ACTIONS = [
  {
    id: 'explain',
    label: 'Explain',
    icon: BookOpen,
    mode: 'explain_concepts',
    promptPrefix: 'Explain how ',
  },
  {
    id: 'write',
    label: 'Write',
    icon: PenLine,
    mode: 'write_content',
    promptPrefix: 'Help me write ',
  },
  {
    id: 'research',
    label: 'Research',
    icon: Search,
    mode: 'general',
    promptPrefix: 'Research and analyze ',
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm',
    icon: Lightbulb,
    mode: 'generate_ideas',
    promptPrefix: 'Brainstorm ideas for ',
  },
  {
    id: 'code',
    label: 'Code',
    icon: Code2,
    mode: 'code_assistance',
    promptPrefix: 'Write code to ',
  },
  {
    id: 'create_image',
    label: 'Create image',
    icon: ImageIcon,
    mode: 'general',
    promptPrefix: 'Create an image of ',
  },
]

export default function NewChatView({ onNavigateToImages }) {
  const {
    chats,
    setChats,
    activeChatId,
    setActiveChatId,
    language,
    isLoading,
    setIsLoading,
    chatMode,
    setChatMode,
    personas,
    activePersonaId,
    extendedThinking,
    toggleExtendedThinking,
  } = useContext(ChatContext)

  const [inputVal, setInputVal] = useState('')
  const [attachments, setAttachments] = useState([])
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const isMobile = useMediaQuery('(max-width: 640px)')
  const isTablet = useMediaQuery('(max-width: 1024px)')

  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const modeDropdownRef = useRef(null)
  const recognitionRef = useRef(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const scrollHeight = el.scrollHeight
    const minHeight = 24
    const maxHeight = 160
    const targetHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
    el.style.height = `${targetHeight}px`
    el.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [inputVal])

  // Close mode dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target)) {
        setModeDropdownOpen(false)
      }
    }
    if (modeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [modeDropdownOpen])

  // Speech recognition
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.')
      return
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setIsRecording(false)
      return
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRec()
    recognitionRef.current = recognition
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = language || 'en-US'

    recognition.onstart = () => {
      setIsRecording(true)
    }

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('')
      setInputVal(transcript)
    }

    recognition.onerror = () => {
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognition.start()
  }

  // Handle file selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const newAttachments = files.map((file) => ({
      file,
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 'document',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }))

    setAttachments((prev) => [...prev, ...newAttachments])
    e.target.value = ''
    if (textareaRef.current) textareaRef.current.focus()
  }

  const removeAttachment = (index) => {
    setAttachments((prev) => {
      const updated = [...prev]
      if (updated[index]?.previewUrl) {
        URL.revokeObjectURL(updated[index].previewUrl)
      }
      updated.splice(index, 1)
      return updated
    })
  }

  // Main submission handler
  const handleSubmit = useCallback(
    async (overrideText, overrideAttachments) => {
      const promptText = (overrideText !== undefined ? overrideText : inputVal).trim()
      const promptAttachments = overrideAttachments !== undefined ? overrideAttachments : attachments

      if ((!promptText && promptAttachments.length === 0) || isLoading) return

      // Create new chat or use existing active chat
      let targetChatId = activeChatId
      let currentChat = chats.find((c) => c.id === activeChatId)

      if (!targetChatId || !currentChat) {
        const newId = Date.now().toString()
        const newChatObj = {
          id: newId,
          title: 'New chat',
          messages: [],
        }
        setChats((prev) => [newChatObj, ...prev])
        setActiveChatId(newId)
        targetChatId = newId
        currentChat = newChatObj
      }

      const attachmentMeta = promptAttachments.map((a) => ({
        name: a.name,
        type: a.type,
        previewUrl: a.previewUrl,
      }))

      const updatedMessages = [
        ...currentChat.messages,
        { sender: 'user', text: promptText, attachments: attachmentMeta },
      ]
      const botMsg = { sender: 'bot', text: '', isStreaming: true }

      setChats((prev) =>
        prev.map((c) => (c.id === targetChatId ? { ...c, messages: [...updatedMessages, botMsg] } : c))
      )

      setInputVal('')
      setAttachments([])
      setIsLoading(true)

      const normalizedLanguage = normalizeLanguageCode(language)

      try {
        // Document generation check
        const docRequest = promptAttachments.length === 0 ? extractDocumentRequest(promptText) : null
        if (docRequest) {
          const docResult = await generateDocument({
            format: docRequest.format,
            prompt: docRequest.subject,
            language: normalizedLanguage,
          })

          setIsLoading(false)
          setChats((prev) =>
            prev.map((c) =>
              c.id === targetChatId
                ? {
                    ...c,
                    messages: c.messages.map((m, idx) =>
                      idx === c.messages.length - 1
                        ? {
                            ...m,
                            text: 'Generated document ready.',
                            isStreaming: false,
                            attachments: [
                              {
                                name: docResult.filename,
                                type: 'document',
                                downloadUrl: docResult.download_url,
                                format: docRequest.format,
                              },
                            ],
                          }
                        : m
                    ),
                  }
                : c
            )
          )
          return
        }

        // Image generation check
        const isImageRequest = IMAGE_REQUEST_RE.test(promptText) && promptAttachments.length === 0
        if (isImageRequest) {
          const imagePrompt = extractImagePrompt(promptText)
          const imageResult = await generateAIImage({
            prompt: imagePrompt,
            style: 'cinematic',
            quality: 'hd',
            size: '1024x1024',
          })

          setIsLoading(false)
          setChats((prev) =>
            prev.map((c) =>
              c.id === targetChatId
                ? {
                    ...c,
                    messages: c.messages.map((m, idx) =>
                      idx === c.messages.length - 1
                        ? {
                            ...m,
                            text: 'Generated image ready.',
                            isStreaming: false,
                            attachments: [
                              {
                                name: `generated-${Date.now()}.png`,
                                type: 'image',
                                previewUrl: imageResult.image,
                              },
                            ],
                          }
                        : m
                    ),
                  }
                : c
            )
          )
          return
        }

        // Upload attachment handling
        if (promptAttachments.length > 0) {
          let data
          try {
            data = await sendOrchestratedUploadMessage(
              promptText,
              normalizedLanguage,
              targetChatId,
              chatMode,
              promptAttachments,
              extendedThinking
            )
          } catch (uploadErr) {
            console.warn('Upload analysis failed, falling back to standard orchestrator:', uploadErr)
            const fallbackText = `${promptText}\n[Note: Attachment parsing endpoint unavailable.]`
            data = await sendOrchestratedMessage(fallbackText, normalizedLanguage, targetChatId, chatMode, extendedThinking)
          }
          setIsLoading(false)

          if (data && data.response) {
            const responseText = data.response
            const sources = data.web_search_sources || []
            const thinking = data.thinking

            setChats((prev) =>
              prev.map((c) =>
                c.id === targetChatId
                  ? {
                      ...c,
                      messages: c.messages.map((m, idx) =>
                        idx === c.messages.length - 1
                          ? { ...m, text: responseText, isStreaming: false, sources, thinking }
                          : m
                      ),
                    }
                  : c
              )
            )
          } else {
            throw new Error('Invalid response from server')
          }
        } else {
          // Standard streaming LLM response
          const activePersona = personas.find((p) => p.id === activePersonaId)
          let sawResponse = false

          await sendOrchestratedMessageStream({
            text: promptText,
            language: normalizedLanguage,
            user_id: targetChatId,
            chatMode,
            personaSystemPrompt: activePersona?.system_prompt,
            extendedThinking,
            onThinking: (thinking) => {
              setChats((prev) =>
                prev.map((c) =>
                  c.id === targetChatId
                    ? {
                        ...c,
                        messages: c.messages.map((m, idx) =>
                          idx === c.messages.length - 1 ? { ...m, thinking } : m
                        ),
                      }
                    : c
                )
              )
            },
            onChunk: (chunk) => {
              sawResponse = true
              setChats((prev) =>
                prev.map((c) =>
                  c.id === targetChatId
                    ? {
                        ...c,
                        messages: c.messages.map((m, idx) =>
                          idx === c.messages.length - 1 ? { ...m, text: (m.text || '') + chunk } : m
                        ),
                      }
                    : c
                )
              )
            },
            onSources: (sources) => {
              setChats((prev) =>
                prev.map((c) =>
                  c.id === targetChatId
                    ? {
                        ...c,
                        messages: c.messages.map((m, idx) =>
                          idx === c.messages.length - 1 ? { ...m, sources } : m
                        ),
                      }
                    : c
                )
              )
            },
            onDone: () => {
              setIsLoading(false)
              setChats((prev) =>
                prev.map((c) =>
                  c.id === targetChatId
                    ? {
                        ...c,
                        messages: c.messages.map((m, idx) =>
                          idx === c.messages.length - 1 ? { ...m, isStreaming: false } : m
                        ),
                      }
                    : c
                )
              )
            },
          })

          if (!sawResponse) {
            throw new Error('Invalid response from server')
          }
        }
      } catch (err) {
        console.error('Error submitting prompt in NewChatView:', err)
        setIsLoading(false)
        setChats((prev) =>
          prev.map((c) =>
            c.id === targetChatId
              ? {
                  ...c,
                  messages: c.messages.map((m, idx) =>
                    idx === c.messages.length - 1
                      ? {
                          ...m,
                          text: 'Server error. Please try again.',
                          isStreaming: false,
                          error: true,
                        }
                      : m
                  ),
                }
              : c
          )
        )
      }
    },
    [
      inputVal,
      attachments,
      isLoading,
      activeChatId,
      chats,
      setChats,
      setActiveChatId,
      setIsLoading,
      language,
      chatMode,
      personas,
      activePersonaId,
    ]
  )

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleQuickAction = (action) => {
    if (action.mode && action.mode !== chatMode) {
      setChatMode(action.mode)
    }

    if (action.id === 'create_image' && onNavigateToImages) {
      setInputVal(action.promptPrefix)
      if (textareaRef.current) {
        textareaRef.current.focus()
        setTimeout(() => {
          textareaRef.current?.setSelectionRange(
            action.promptPrefix.length,
            action.promptPrefix.length
          )
        }, 10)
      }
      return
    }

    setInputVal(action.promptPrefix)
    if (textareaRef.current) {
      textareaRef.current.focus()
      setTimeout(() => {
        textareaRef.current?.setSelectionRange(
          action.promptPrefix.length,
          action.promptPrefix.length
        )
      }, 10)
    }
  }

  const currentModeObj = CHAT_MODES.find((m) => m.id === chatMode) || CHAT_MODES[0]
  const CurrentModeIcon = currentModeObj.icon

  const hasContent = inputVal.trim().length > 0 || attachments.length > 0

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'var(--pragna-bg)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
      className="custom-scrollbar"
    >
      {/* Subtle ambient warm gold radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-100px',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '680px',
          height: '420px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(212, 175, 55, 0.04) 0%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Top Header tracking phrase */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: isMobile ? '16px 20px 0 20px' : '22px 36px 0 36px',
          zIndex: 2,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: isMobile ? '10px' : '11px',
            letterSpacing: isMobile ? '2px' : '3.2px',
            fontWeight: 600,
            color: 'var(--pragna-text-muted)',
            opacity: 0.7,
            textTransform: 'uppercase',
            userSelect: 'none',
          }}
        >
          EXPLORE &middot; LEARN &middot; CREATE &middot; EVOLVE
        </span>
      </div>

      {/* Center Main Content Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '24px 16px 36px 16px' : '40px 24px 48px 24px',
          zIndex: 1,
          width: '100%',
          maxWidth: '920px',
          margin: '0 auto',
          boxSizing: 'border-box',
          animation: 'fadeUp 0.35s ease',
        }}
      >
        {/* Shield Logo Mark */}
        <div
          style={{
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={pragnaShield}
            alt="Pragna"
            style={{
              width: isMobile ? '46px' : '54px',
              height: isMobile ? '46px' : '54px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 16px rgba(212, 175, 55, 0.28))',
              transition: 'transform 0.25s ease',
            }}
            className="hover:scale-105"
          />
        </div>

        {/* Eyebrow */}
        <div
          style={{
            fontSize: isMobile ? '10.5px' : '11.5px',
            letterSpacing: '2.8px',
            fontWeight: 600,
            color: 'var(--pragna-text-muted)',
            textTransform: 'uppercase',
            marginBottom: '10px',
            textAlign: 'center',
            userSelect: 'none',
          }}
        >
          A NEW CONVERSATION
        </div>

        {/* Main Heading */}
        <h1
          style={{
            margin: '0 0 10px 0',
            fontSize: isMobile ? '26px' : isTablet ? '32px' : '38px',
            fontWeight: 650,
            color: 'var(--pragna-text)',
            textAlign: 'center',
            lineHeight: 1.22,
            letterSpacing: '-0.5px',
          }}
        >
          How can Pragna help you{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #f5ebd9 0%, #e5c76b 60%, #d4af37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: isMobile ? 'inline' : 'inline',
            }}
          >
            today?
          </span>
        </h1>

        {/* Supporting Subtitle */}
        <p
          style={{
            margin: '0 0 28px 0',
            fontSize: isMobile ? '13.5px' : '15px',
            color: 'var(--pragna-text-muted)',
            textAlign: 'center',
            maxWidth: '520px',
            lineHeight: 1.5,
          }}
        >
          Ask, explore, create or dive into any topic.
        </p>

        {/* Main Prompt Input Box */}
        <div
          style={{
            width: '100%',
            maxWidth: '740px',
            background: 'var(--pragna-surface-2)',
            border: isFocused
              ? '1px solid rgba(212, 175, 55, 0.55)'
              : '1px solid rgba(212, 175, 55, 0.22)',
            borderRadius: '22px',
            boxShadow: isFocused
              ? '0 10px 32px rgba(0, 0, 0, 0.5), 0 0 24px rgba(212, 175, 55, 0.14)'
              : '0 4px 20px rgba(0, 0, 0, 0.35), 0 0 14px rgba(212, 175, 55, 0.04)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            padding: isMobile ? '12px 14px' : '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            position: 'relative',
            marginBottom: '22px',
          }}
        >
          {/* Attachment preview chips */}
          {attachments.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(212, 175, 55, 0.12)',
              }}
            >
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'rgba(212, 175, 55, 0.1)',
                    border: '1px solid rgba(212, 175, 55, 0.25)',
                    fontSize: '12px',
                    color: 'var(--pragna-text)',
                    maxWidth: '220px',
                  }}
                >
                  {att.type === 'image' ? (
                    <ImageIcon size={13} className="text-[var(--pragna-gold-soft)] flex-shrink-0" />
                  ) : (
                    <FileText size={13} className="text-[var(--pragna-gold-soft)] flex-shrink-0" />
                  )}
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {att.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--pragna-text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    className="hover:text-[var(--pragna-gold-soft)]"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Text input area */}
          <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%', minHeight: '26px' }}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask Pragna anything..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--pragna-text)',
                fontSize: isMobile ? '14px' : '15px',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                resize: 'none',
                padding: '2px 4px',
              }}
            />
          </div>

          {/* Bottom row inside input: Controls (Mode, Attach, Mic, Send) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              paddingTop: '2px',
            }}
          >
            {/* Left side: Mode selector dropdown & Think button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative' }} ref={modeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setModeDropdownOpen((prev) => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    borderRadius: '999px',
                    background: 'rgba(212, 175, 55, 0.08)',
                    border: '1px solid rgba(212, 175, 55, 0.22)',
                    color: 'var(--pragna-gold-soft)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    letterSpacing: '0.2px',
                  }}
                  className="hover:bg-[rgba(212,175,55,0.16)] hover:border-accent-500/40"
                >
                  <CurrentModeIcon size={13} />
                  <span>{currentModeObj.label}</span>
                  <ChevronDown
                    size={12}
                    style={{
                      transform: modeDropdownOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                      opacity: 0.8,
                    }}
                  />
                </button>

                {/* Mode Dropdown Popover */}
                {modeDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: '0',
                      zIndex: 40,
                      width: '190px',
                      borderRadius: '14px',
                      background: 'var(--pragna-surface)',
                      border: '1px solid rgba(212, 175, 55, 0.28)',
                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(212, 175, 55, 0.1)',
                      backdropFilter: 'blur(12px)',
                      padding: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      animation: 'fadeUp 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        letterSpacing: '1.2px',
                        color: 'var(--pragna-text-muted)',
                        textTransform: 'uppercase',
                        padding: '6px 10px 4px 10px',
                      }}
                    >
                      Select Chat Mode
                    </div>
                    {CHAT_MODES.map((mode) => {
                      const active = chatMode === mode.id
                      const ModeIcon = mode.icon
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            setChatMode(mode.id)
                            setModeDropdownOpen(false)
                            if (textareaRef.current) textareaRef.current.focus()
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: 'none',
                            background: active ? 'rgba(212, 175, 55, 0.14)' : 'transparent',
                            color: active ? 'var(--pragna-gold-soft)' : 'var(--pragna-text)',
                            fontSize: '13px',
                            fontWeight: active ? 650 : 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.12s ease',
                          }}
                          className="hover:bg-[rgba(212,175,55,0.1)] hover:text-[var(--pragna-gold-soft)]"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ModeIcon size={14} />
                            <span>{mode.label}</span>
                          </div>
                          {active && <Check size={13} className="text-[var(--pragna-gold-soft)]" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Extended Thinking Toggle */}
              <button
                type="button"
                onClick={toggleExtendedThinking}
                title={extendedThinking ? "Extended Thinking enabled (Deep Reasoning)" : "Enable Extended Thinking (Deep Reasoning)"}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '999px',
                  background: extendedThinking ? 'rgba(212, 175, 55, 0.14)' : 'transparent',
                  border: extendedThinking ? '1px solid rgba(212, 175, 55, 0.45)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: extendedThinking ? 'var(--pragna-gold-soft)' : 'var(--pragna-text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: extendedThinking ? '0 0 10px rgba(212, 175, 55, 0.2)' : 'none',
                }}
                className="hover:bg-[rgba(212,175,55,0.08)] hover:text-[var(--pragna-gold-soft)]"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                  <path d="M9 21h6" />
                </svg>
                <span>Think</span>
              </button>
            </div>

            {/* Right side: Attachment, Mic, Send */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".docx,.xlsx,.pdf,.pptx,.txt,.md,.csv,.json,image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach document or image"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--pragna-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                className="hover:text-[var(--pragna-gold-soft)] hover:bg-[rgba(212,175,55,0.1)]"
              >
                <Paperclip size={17} />
              </button>

              {/* Mic / Voice Button */}
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                title={isRecording ? 'Stop recording' : 'Voice input'}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: isRecording ? '1px solid rgba(239, 68, 68, 0.6)' : 'none',
                  background: isRecording ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
                  color: isRecording ? '#ef4444' : 'var(--pragna-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                className={
                  isRecording
                    ? 'animate-pulse'
                    : 'hover:text-[var(--pragna-gold-soft)] hover:bg-[rgba(212,175,55,0.1)]'
                }
              >
                {isRecording ? <MicOff size={17} /> : <Mic size={17} />}
              </button>

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!hasContent || isLoading}
                title="Send message"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: 'none',
                  background: hasContent
                    ? 'linear-gradient(135deg, var(--pragna-gold-soft), var(--pragna-accent))'
                    : 'rgba(212, 175, 55, 0.15)',
                  color: hasContent ? '#1a1405' : 'var(--pragna-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: hasContent && !isLoading ? 'pointer' : 'default',
                  opacity: hasContent && !isLoading ? 1 : 0.45,
                  boxShadow:
                    hasContent && !isLoading
                      ? '0 2px 10px rgba(212, 175, 55, 0.4), 0 0 12px rgba(212, 175, 55, 0.2)'
                      : 'none',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: hasContent && !isLoading ? 'scale(1)' : 'scale(0.95)',
                }}
                className={
                  hasContent && !isLoading
                    ? 'hover:scale-105 active:scale-95 hover:shadow-[0_4px_16px_rgba(212,175,55,0.5)]'
                    : ''
                }
              >
                <ArrowUp size={18} strokeWidth={2.6} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Action Chips */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? '8px' : '10px',
            width: '100%',
            maxWidth: '740px',
          }}
        >
          {QUICK_ACTIONS.map((action) => {
            const IconComponent = action.icon
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleQuickAction(action)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: isMobile ? '7px 14px' : '8px 16px',
                  borderRadius: '999px',
                  background: 'var(--pragna-surface-2)',
                  border: '1px solid rgba(212, 175, 55, 0.18)',
                  color: 'var(--pragna-text-soft)',
                  fontSize: isMobile ? '12.5px' : '13.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
                className="hover:border-accent-500/50 hover:bg-[rgba(212,175,55,0.08)] hover:text-[var(--pragna-gold-soft)] hover:-translate-y-0.5"
              >
                <IconComponent size={14} className="opacity-80" />
                <span>{action.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bottom Footer Tagline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '16px 16px 20px 16px' : '20px 24px 28px 24px',
          flexShrink: 0,
          zIndex: 1,
          userSelect: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '280px',
            width: '100%',
            marginBottom: '6px',
          }}
        >
          <div
            style={{
              flex: 1,
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.25))',
            }}
          />
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '2.5px',
              color: 'var(--pragna-text-muted)',
              opacity: 0.7,
            }}
          >
            PRAGNA-1A
          </span>
          <div
            style={{
              flex: 1,
              height: '1px',
              background: 'linear-gradient(90deg, rgba(212, 175, 55, 0.25), transparent)',
            }}
          />
        </div>
        <span
          style={{
            fontSize: '9.5px',
            letterSpacing: '2px',
            fontWeight: 600,
            color: 'var(--pragna-text-muted)',
            opacity: 0.5,
            textTransform: 'uppercase',
          }}
        >
          CURIOSITY DRIVES PROGRESS
        </span>
      </div>
    </div>
  )
}
