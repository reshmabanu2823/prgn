import React, { useEffect, useRef, useState, useCallback } from 'react';
import './voice.css';

// Language tags for SpeechRecognition and SpeechSynthesis
const LANG_VOICE_MAP = {
  en: { tag: 'en-IN', fallback: 'en-US', name: 'English' },
  hi: { tag: 'hi-IN', fallback: 'hi', name: 'Hindi' },
  kn: { tag: 'kn-IN', fallback: 'kn', name: 'Kannada' },
  te: { tag: 'te-IN', fallback: 'te', name: 'Telugu' },
  ta: { tag: 'ta-IN', fallback: 'ta', name: 'Tamil' },
  ml: { tag: 'ml-IN', fallback: 'ml', name: 'Malayalam' },
  mr: { tag: 'mr-IN', fallback: 'mr', name: 'Marathi' },
  bn: { tag: 'bn-IN', fallback: 'bn', name: 'Bengali' },
  gu: { tag: 'gu-IN', fallback: 'gu', name: 'Gujarati' },
  pa: { tag: 'pa-IN', fallback: 'pa', name: 'Punjabi' },
  ur: { tag: 'ur-IN', fallback: 'ur', name: 'Urdu' },
};

/**
 * Clean markdown for natural text-to-speech pronunciation
 */
function cleanTextForSpeech(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, 'Code snippet omitted.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~#>]/g, '')
    .replace(/•|\d+\.\s+/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

export default function VoiceAssistantModal({
  isOpen,
  onClose,
  currentLanguage = 'en',
  onSendMessage,
  lastAssistantMessage = '',
  isGenerating = false,
}) {
  // States: 'idle' | 'listening' | 'thinking' | 'speaking'
  const [voiceState, setVoiceState] = useState('idle');
  const [userTranscript, setUserTranscript] = useState('');
  const [aiSpeechText, setAiSpeechText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [micError, setMicError] = useState(null);

  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const recognitionRef = useRef(null);
  const currentUtteranceRef = useRef(null);
  const isListeningRef = useRef(false);
  const volumeRef = useRef(0);

  const langConfig = LANG_VOICE_MAP[currentLanguage] || LANG_VOICE_MAP.en;

  // Initialize Web Audio API Analyser for interactive visualizer
  const initAudioAnalyser = useCallback(async () => {
    try {
      if (audioContextRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      setMicError(null);
    } catch (err) {
      console.warn("Microphone stream error:", err);
      setMicError("Microphone access is required for voice mode.");
    }
  }, []);

  // Cleanup audio tracks and synthesizer
  const cleanupAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    isListeningRef.current = false;
  }, []);

  // Speak AI response with browser SpeechSynthesis
  const speakResponse = useCallback((text) => {
    if (!('speechSynthesis' in window) || !text) {
      setVoiceState('idle');
      return;
    }

    window.speechSynthesis.cancel();
    const clean = cleanTextForSpeech(text);
    if (!clean) {
      setVoiceState('idle');
      return;
    }

    setAiSpeechText(clean);
    setVoiceState('speaking');

    const utterance = new SpeechSynthesisUtterance(clean);
    currentUtteranceRef.current = utterance;

    // Pick best regional voice
    const voices = window.speechSynthesis.getVoices();
    const targetTag = langConfig.tag.toLowerCase();
    const fallbackTag = langConfig.fallback.toLowerCase();

    let matchedVoice = voices.find((v) => v.lang.toLowerCase() === targetTag);
    if (!matchedVoice) {
      matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(fallbackTag));
    }
    if (!matchedVoice) {
      matchedVoice = voices.find((v) => v.lang.toLowerCase().includes('en') || v.default);
    }
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setVoiceState('idle');
      currentUtteranceRef.current = null;
      // Auto resume listening for hands-free loop
      if (!isMuted && isOpen) {
        setTimeout(() => startListening(), 400);
      }
    };

    utterance.onerror = (e) => {
      console.warn("SpeechSynthesis error:", e);
      setVoiceState('idle');
      currentUtteranceRef.current = null;
      if (!isMuted && isOpen) {
        setTimeout(() => startListening(), 400);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [langConfig, isMuted, isOpen]);

  // Start Speech Recognition
  const startListening = useCallback(() => {
    if (isMuted || !isOpen) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setMicError("Speech recognition not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    // Stop speaking if was talking
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } catch {}

    const recognition = new SpeechRec();
    recognitionRef.current = recognition;
    recognition.lang = langConfig.tag || 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onstart = () => {
      isListeningRef.current = true;
      setVoiceState('listening');
      setUserTranscript('');
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }
      setUserTranscript(finalTranscript || interim);
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      const query = finalTranscript.trim();
      if (query && onSendMessage) {
        setVoiceState('thinking');
        onSendMessage(query);
      } else {
        setVoiceState('idle');
      }
    };

    recognition.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
      isListeningRef.current = false;
      setVoiceState('idle');
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn("Could not start recognition:", e);
    }
  }, [isMuted, isOpen, langConfig, onSendMessage]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    isListeningRef.current = false;
  }, []);

  // Interrupt speaking (ChatGPT style: tap orb to stop speech and speak next)
  const interrupt = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setVoiceState('idle');
    setTimeout(() => startListening(), 250);
  }, [startListening]);

  // When assistant finishes generating response, speak it aloud
  useEffect(() => {
    if (isOpen && !isGenerating && lastAssistantMessage && voiceState === 'thinking') {
      speakResponse(lastAssistantMessage);
    }
  }, [isOpen, isGenerating, lastAssistantMessage, voiceState, speakResponse]);

  // Initialize on modal open
  useEffect(() => {
    if (isOpen) {
      initAudioAnalyser();
      const timer = setTimeout(() => {
        startListening();
      }, 500);
      return () => {
        clearTimeout(timer);
        cleanupAudio();
      };
    } else {
      cleanupAudio();
    }
  }, [isOpen, initAudioAnalyser, startListening, cleanupAudio]);

  // 60fps Canvas Animation for the Interactive Glowing Orb
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = canvas.offsetWidth * window.devicePixelRatio || 300);
    let height = (canvas.height = canvas.offsetHeight * window.devicePixelRatio || 300);

    let phase = 0;
    const dataArray = new Uint8Array(32);

    const render = () => {
      phase += 0.03;

      // Extract real-time mic volume if available
      let audioVolume = 0;
      if (analyserRef.current && voiceState === 'listening') {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        audioVolume = sum / dataArray.length / 255;
      } else if (voiceState === 'speaking') {
        // Simulated vocal modulation cadence
        audioVolume = 0.35 + Math.sin(phase * 4) * 0.25 + Math.cos(phase * 7) * 0.15;
      } else if (voiceState === 'thinking') {
        audioVolume = 0.2 + Math.sin(phase * 6) * 0.15;
      } else {
        audioVolume = 0.05 + Math.sin(phase * 1.5) * 0.05; // Gentle breath
      }

      // Smooth volume interpolation
      volumeRef.current += (audioVolume - volumeRef.current) * 0.15;
      const smoothVol = volumeRef.current;

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.26;

      // Color scheme based on state
      let primaryColor = 'rgba(212, 175, 55, 1)'; // Pragna Gold
      let glowColor = 'rgba(212, 175, 55, 0.4)';
      if (voiceState === 'listening') {
        primaryColor = 'rgba(56, 189, 248, 1)'; // Sky Blue
        glowColor = 'rgba(56, 189, 248, 0.45)';
      } else if (voiceState === 'thinking') {
        primaryColor = 'rgba(245, 158, 11, 1)'; // Amber
        glowColor = 'rgba(245, 158, 11, 0.45)';
      } else if (voiceState === 'speaking') {
        primaryColor = 'rgba(229, 193, 88, 1)'; // Bright Radiant Gold
        glowColor = 'rgba(229, 193, 88, 0.5)';
      }

      // Outer ambient glowing aura
      const gradientAura = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.6,
        centerX,
        centerY,
        baseRadius * (1.6 + smoothVol * 0.8)
      );
      gradientAura.addColorStop(0, glowColor);
      gradientAura.addColorStop(0.5, 'rgba(212, 175, 55, 0.15)');
      gradientAura.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradientAura;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * (1.6 + smoothVol * 0.8), 0, Math.PI * 2);
      ctx.fill();

      // Multi-layer pulsating energy waves
      const waveLayers = voiceState === 'thinking' ? 4 : 3;
      for (let layer = 0; layer < waveLayers; layer++) {
        ctx.beginPath();
        const layerOffset = (layer * Math.PI) / 3;
        const speedMultiplier = voiceState === 'thinking' ? 2.5 : 1.2;

        for (let angle = 0; angle <= Math.PI * 2; angle += 0.08) {
          const wave =
            Math.sin(angle * 3 + phase * speedMultiplier + layerOffset) * (8 + smoothVol * 30) +
            Math.cos(angle * 5 - phase * 0.8) * (4 + smoothVol * 15);
          const r = baseRadius + wave;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (angle === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();

        const strokeAlpha = 0.35 + layer * 0.2 + smoothVol * 0.3;
        ctx.strokeStyle = primaryColor.replace('1)', `${strokeAlpha})`);
        ctx.lineWidth = 2.5 * window.devicePixelRatio;
        ctx.stroke();
      }

      // Inner Core Gradient Sphere
      const coreGradient = ctx.createRadialGradient(
        centerX - baseRadius * 0.25,
        centerY - baseRadius * 0.25,
        baseRadius * 0.1,
        centerX,
        centerY,
        baseRadius * (0.95 + smoothVol * 0.3)
      );
      coreGradient.addColorStop(0, '#fffef0');
      coreGradient.addColorStop(0.35, primaryColor);
      coreGradient.addColorStop(0.85, 'rgba(160, 124, 49, 0.85)');
      coreGradient.addColorStop(1, 'rgba(20, 18, 12, 0.95)');

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * (0.92 + smoothVol * 0.25), 0, Math.PI * 2);
      ctx.fill();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, voiceState]);

  if (!isOpen) return null;

  return (
    <div className="pragna-voice-overlay" role="dialog" aria-modal="true" aria-label="Pragna Voice Assistant">
      {/* Top Bar */}
      <div className="pragna-voice-header">
        <div className="pragna-voice-status-pill">
          <span className={`pragna-voice-dot ${voiceState}`} />
          {voiceState === 'listening' && 'Listening...'}
          {voiceState === 'thinking' && 'Pragna is thinking...'}
          {voiceState === 'speaking' && 'Pragna is speaking...'}
          {voiceState === 'idle' && (isMuted ? 'Muted' : 'Ready to talk')}
        </div>

        <button
          className="pragna-voice-close-btn"
          onClick={onClose}
          title="Exit Voice Mode"
          aria-label="Exit Voice Mode"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Center Stage & Dynamic Orb */}
      <div className="pragna-voice-stage">
        <div
          className="pragna-voice-orb-container"
          onClick={voiceState === 'speaking' ? interrupt : startListening}
          title={voiceState === 'speaking' ? "Tap to interrupt Pragna" : "Tap to speak"}
        >
          <div className="pragna-voice-glow-ring" />
          <canvas ref={canvasRef} className="pragna-voice-orb-canvas" />
        </div>

        {/* Live Transcripts */}
        <div className="pragna-voice-transcript-box">
          {voiceState === 'speaking' && aiSpeechText && (
            <div className="pragna-voice-transcript-ai">
              "{aiSpeechText.length > 140 ? aiSpeechText.slice(0, 140) + '...' : aiSpeechText}"
            </div>
          )}

          {voiceState === 'listening' && userTranscript && (
            <div className="pragna-voice-transcript-user">
              You: "{userTranscript}"
            </div>
          )}

          {voiceState === 'thinking' && (
            <div className="pragna-voice-transcript-user">
              Processing your request...
            </div>
          )}

          {voiceState === 'idle' && !userTranscript && (
            <div className="pragna-voice-hint">
              Tap the orb or start speaking ({langConfig.name})
            </div>
          )}

          {micError && (
            <div style={{ color: '#f87171', fontSize: '13px', marginTop: '8px' }}>
              {micError}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="pragna-voice-controls">
        {/* Mute / Unmute Toggle */}
        <button
          className={`pragna-voice-btn ${isMuted ? 'danger' : ''}`}
          onClick={() => {
            if (!isMuted) {
              stopListening();
              setIsMuted(true);
              setVoiceState('idle');
            } else {
              setIsMuted(false);
              setTimeout(() => startListening(), 200);
            }
          }}
          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isMuted ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* Tap to Interrupt Pill (Only visible when speaking) */}
        {voiceState === 'speaking' && (
          <button className="pragna-voice-interrupt-pill" onClick={interrupt}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Tap to interrupt
          </button>
        )}

        {/* Exit voice mode */}
        <button
          className="pragna-voice-btn"
          onClick={onClose}
          title="Exit to chat"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
