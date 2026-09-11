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
  PaperclipIcon,
  MicIcon,
  MicOffIcon,
  SendIcon,
  ChevronDownIcon,
  BookOpenIcon,
  PenLineIcon,
  SearchIcon,
  LightbulbIcon,
  CodeIcon,
  CreateImageIcon,
  FileTextIcon,
  CloseIcon,
  CheckIcon,
  SparklesIcon,
  ThinkIcon,
} from './PragnaIcon'

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
  { id: 'explain_concepts', label: 'Explain', icon: BookOpenIcon },
  { id: 'write_content', label: 'Write', icon: PenLineIcon },
  { id: 'generate_ideas', label: 'Brainstorm', icon: LightbulbIcon },
  { id: 'code_assistance', label: 'Code', icon: CodeIcon },
  { id: 'ask_questions', label: 'Questions', icon: SearchIcon },
  { id: 'creative_writing', label: 'Story', icon: PenLineIcon },
]

const QUICK_ACTIONS = [
  {
    id: 'explain',
    label: 'Explain',
    icon: BookOpenIcon,
    mode: 'explain_concepts',
    promptPrefix: 'Explain how ',
  },
  {
    id: 'write',
    label: 'Write',
    icon: PenLineIcon,
    mode: 'write_content',
    promptPrefix: 'Help me write ',
  },
  {
    id: 'research',
    label: 'Research',
    icon: SearchIcon,
    mode: 'general',
    promptPrefix: 'Research and analyze ',
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm',
    icon: LightbulbIcon,
    mode: 'generate_ideas',
    promptPrefix: 'Brainstorm ideas for ',
  },
  {
    id: 'code',
    label: 'Code',
    icon: CodeIcon,
    mode: 'code_assistance',
    promptPrefix: 'Write code to ',
  },
  {
    id: 'create_image',
    label: 'Create image',
    icon: CreateImageIcon,
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
    const minHeight = 36
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
          top: '-100px',
          right: '-80px',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.09) 0%, rgba(212, 175, 55, 0.02) 45%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '750px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(212, 175, 55, 0.04) 0%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Celestial Golden Horizon Arc Graphic (Bottom Right) */}
      <svg
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: isMobile ? '280px' : '520px',
          height: isMobile ? '220px' : '380px',
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'visible',
        }}
        viewBox="0 0 520 380"
        fill="none"
      >
        <defs>
          <linearGradient id="celestialArcGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f5ebd9" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#e5c76b" stopOpacity="0.65" />
            <stop offset="70%" stopColor="#d4af37" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#b8860b" stopOpacity="0.0" />
          </linearGradient>
          <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="30%" stopColor="#f5ebd9" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#d4af37" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Outer subtle glow arc */}
        <path
          d="M 520 80 Q 320 180 180 380"
          stroke="#d4af37"
          strokeWidth="6"
          strokeOpacity="0.08"
          fill="none"
        />
        {/* Main luminous arc */}
        <path
          d="M 520 80 Q 320 180 180 380"
          stroke="url(#celestialArcGrad)"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        {/* Secondary inner contour arc */}
        <path
          d="M 520 120 Q 360 210 240 380"
          stroke="url(#celestialArcGrad)"
          strokeWidth="0.8"
          strokeOpacity="0.35"
          fill="none"
        />
        {/* Bright celestial star dot */}
        <circle cx="370" cy="158" r="8" fill="url(#starGlow)" />
        <circle cx="370" cy="158" r="2.5" fill="#ffffff" />
      </svg>

      {/* Top Header tracking phrase */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: isMobile ? '16px 20px 0 20px' : '22px 40px 0 40px',
          zIndex: 2,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: isMobile ? '9.5px' : '11px',
              letterSpacing: isMobile ? '2px' : '3.2px',
              fontWeight: 600,
              color: 'var(--pragna-text-muted)',
              opacity: 0.75,
              textTransform: 'uppercase',
              userSelect: 'none',
            }}
          >
            EXPLORE &nbsp; LEARN &nbsp; CREATE &nbsp; EVOLVE
          </span>
          <span style={{ color: 'var(--pragna-gold-soft)', opacity: 0.5, fontWeight: 300 }}>—</span>
        </div>
      </div>

      {/* Center Main Content Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '20px 16px 32px 16px' : '36px 24px 44px 24px',
          zIndex: 1,
          width: '100%',
          maxWidth: '880px',
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
              filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.35))',
              transition: 'transform 0.25s ease',
            }}
            className="hover:scale-105"
          />
        </div>

        {/* Eyebrow */}
        <div
          style={{
            fontSize: isMobile ? '10.5px' : '11.5px',
            letterSpacing: '3px',
            fontWeight: 600,
            color: 'var(--pragna-gold-soft)',
            opacity: 0.85,
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
              background: 'linear-gradient(135deg, #f5ebd9 0%, #e5c76b 50%, #d4af37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline',
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

        {/* Glowing Capsule Prompt Input Box (Matching Approved Reference Design) */}
        <div
          style={{
            width: '100%',
            maxWidth: '780px',
            background: 'rgba(18, 16, 12, 0.85)',
            border: isFocused
              ? '1.5px solid rgba(212, 175, 55, 0.7)'
              : '1.5px solid rgba(212, 175, 55, 0.42)',
            borderRadius: '9999px',
            boxShadow: isFocused
              ? '0 0 35px rgba(212, 175, 55, 0.22), 0 12px 36px rgba(0, 0, 0, 0.65)'
              : '0 0 24px rgba(212, 175, 55, 0.12), 0 8px 28px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            padding: isMobile ? '6px 10px 6px 14px' : '7px 10px 7px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '6px' : '10px',
            position: 'relative',
            marginBottom: '24px',
            boxSizing: 'border-box',
          }}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".docx,.xlsx,.pdf,.pptx,.txt,.md,.csv,.json,image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {/* Attachment Button (Leftmost) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach document or image"
            style={{
              padding: '6px',
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              color: attachments.length > 0 ? 'var(--pragna-gold-soft)' : '#c9bda2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            className="hover:text-[var(--pragna-gold-soft)] hover:bg-[rgba(212,175,55,0.12)]"
          >
            <PaperclipIcon size={19} strokeWidth={1.9} />
          </button>

          {/* Attachment Chips (Floating preview if attached) */}
          {attachments.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: '999px',
                background: 'rgba(212, 175, 55, 0.14)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                fontSize: '11.5px',
                color: '#fffdf7',
                maxWidth: '130px',
                flexShrink: 0,
              }}
            >
              <FileTextIcon size={12} className="text-[var(--pragna-gold-soft)] flex-shrink-0" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {attachments.length} file{attachments.length > 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => setAttachments([])}
                style={{ background: 'transparent', border: 'none', color: '#c9bda2', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                <CloseIcon size={10} />
              </button>
            </div>
          )}

          {/* Text Input */}
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
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fffdf7',
              caretColor: 'var(--pragna-gold)',
              fontSize: isMobile ? '14px' : '15px',
              fontFamily: 'inherit',
              lineHeight: '22px',
              resize: 'none',
              padding: isMobile ? '7px 4px' : '7px 8px',
              minHeight: '36px',
              height: '36px',
              margin: 0,
              boxSizing: 'border-box',
              maxHeight: '120px',
              verticalAlign: 'middle',
            }}
          />

          {/* Right Action Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '7px', flexShrink: 0 }}>
            {/* Mode selector dropdown */}
            <div style={{ position: 'relative' }} ref={modeDropdownRef}>
              <button
                type="button"
                onClick={() => setModeDropdownOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
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
                <span>{currentModeObj.label}</span>
                <ChevronDownIcon
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
                    top: 'calc(100% + 8px)',
                    right: '0',
                    zIndex: 40,
                    width: '180px',
                    borderRadius: '14px',
                    background: 'var(--pragna-surface)',
                    border: '1px solid rgba(212, 175, 55, 0.28)',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65), 0 0 16px rgba(212, 175, 55, 0.12)',
                    backdropFilter: 'blur(14px)',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    animation: 'fadeUp 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
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
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: active ? 'rgba(212, 175, 55, 0.14)' : 'transparent',
                          color: active ? 'var(--pragna-gold-soft)' : 'var(--pragna-text)',
                          fontSize: '12.5px',
                          fontWeight: active ? 650 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.12s ease',
                        }}
                        className="hover:bg-[rgba(212,175,55,0.1)] hover:text-[var(--pragna-gold-soft)]"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ModeIcon size={13} />
                          <span>{mode.label}</span>
                        </div>
                        {active && <CheckIcon size={12} className="text-[var(--pragna-gold-soft)]" />}
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
              title={extendedThinking ? "Extended Thinking enabled" : "Enable Extended Thinking"}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 8px',
                borderRadius: '999px',
                background: extendedThinking ? 'rgba(212, 175, 55, 0.16)' : 'transparent',
                border: extendedThinking ? '1px solid rgba(212, 175, 55, 0.45)' : '1px solid transparent',
                color: extendedThinking ? 'var(--pragna-gold-soft)' : '#c9bda2',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              className="hover:text-[var(--pragna-gold-soft)]"
            >
              <ThinkIcon size={14} />
            </button>

            {/* Mic / Voice Button */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              title={isRecording ? 'Stop recording' : 'Voice input'}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: isRecording ? '1px solid rgba(239, 68, 68, 0.6)' : 'none',
                background: isRecording ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
                color: isRecording ? '#ef4444' : '#c9bda2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              className={isRecording ? 'animate-pulse' : 'hover:text-[var(--pragna-gold-soft)]'}
            >
              {isRecording ? <MicOffIcon size={17} /> : <MicIcon size={17} />}
            </button>

            {/* Send Button (Solid Gold Circular Pill matching Reference Design) */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!hasContent || isLoading}
              title="Send message"
              style={{
                width: isMobile ? '36px' : '40px',
                height: isMobile ? '36px' : '40px',
                borderRadius: '50%',
                border: 'none',
                background: hasContent
                  ? 'linear-gradient(135deg, #f5ebd9 0%, #e5c76b 50%, #d4af37 100%)'
                  : 'linear-gradient(135deg, #f5ebd9 0%, #e5c76b 50%, #d4af37 100%)',
                color: '#14120c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: hasContent && !isLoading ? 'pointer' : 'default',
                opacity: hasContent && !isLoading ? 1 : 0.65,
                boxShadow: '0 2px 14px rgba(212, 175, 55, 0.45)',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: hasContent && !isLoading ? 'scale(1.02)' : 'scale(1)',
              }}
              className={
                hasContent && !isLoading
                  ? 'hover:scale-108 active:scale-95 hover:shadow-[0_4px_18px_rgba(212,175,55,0.6)]'
                  : ''
              }
            >
              <SendIcon size={17} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* Quick Action Chips (6 Pill Capsules matching Reference Design) */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? '8px' : '10px',
            width: '100%',
            maxWidth: '780px',
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
                  padding: isMobile ? '7px 14px' : '9px 18px',
                  borderRadius: '999px',
                  background: 'rgba(22, 19, 14, 0.65)',
                  border: '1px solid rgba(212, 175, 55, 0.22)',
                  color: 'var(--pragna-text-soft)',
                  fontSize: isMobile ? '12.5px' : '13.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  backdropFilter: 'blur(8px)',
                }}
                className="hover:border-accent-500/60 hover:bg-[rgba(212,175,55,0.12)] hover:text-[var(--pragna-gold-soft)] hover:shadow-[0_0_12px_rgba(212,175,55,0.25)] hover:-translate-y-0.5"
              >
                <IconComponent size={14} className="opacity-90 text-[var(--pragna-gold-soft)]" />
                <span>{action.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bottom Left Tagline (Matching Reference Design) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: isMobile ? '16px 20px 20px 20px' : '20px 40px 28px 40px',
          flexShrink: 0,
          zIndex: 1,
          userSelect: 'none',
        }}
      >
        <span style={{ color: 'var(--pragna-gold-soft)', opacity: 0.6, fontSize: '14px', lineHeight: 1 }}>—</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '2.4px',
              color: 'var(--pragna-text-muted)',
              opacity: 0.75,
              textTransform: 'uppercase',
            }}
          >
            SAME CURIOSITY.
          </span>
          <span
            style={{
              fontSize: '9.5px',
              letterSpacing: '2px',
              fontWeight: 600,
              color: 'var(--pragna-text-muted)',
              opacity: 0.55,
              textTransform: 'uppercase',
            }}
          >
            A BRIGHTER TOMORROW.
          </span>
        </div>
      </div>
    </div>
  )
}
