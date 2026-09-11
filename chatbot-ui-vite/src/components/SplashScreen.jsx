import { useEffect, useState } from "react";
import etherxLogo from "../assets/etherx-logo.png";
import pragnaLogoFull from "../assets/pragna-logo-full.png";
import pragnaWordmark from "../assets/pragna-wordmark.png";

// Full 8-frame sequence from the "Pragna Splash screen" Figma file, in canvas
// order (left to right): EtherX intro -> Hindi -> Kannada -> Telugu -> Tamil
// -> English (full Pragna wordmark) -> EtherX ending -> closing tagline.
//
// Two background elements tie the frames together, exactly as in the file:
// - a huge gold triangle ("Polygon 1") whose x position slides further left
//   on every frame (1043 -> 642 -> 326 -> 120 -> -134 -> -268 -> -270 on the
//   1440px canvas), so its visible sliver morphs from a top-right corner
//   accent into a full-width top band;
// - a #c9b037 rectangle anchored top-right that appears from the Kannada
//   frame onward, filling the gap the triangle leaves as it exits left.
//
// Regional titles render in per-script Noto fonts (single combined stylesheet
// loaded on mount); title color #a07c31 and white subtitles per the file.

const GOLD_BAND = "#c9b037";
const GOLD_TITLE = "#a07c31";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@700&family=Noto+Sans+Kannada:wght@700&family=Noto+Sans+Telugu:wght@700&family=Noto+Sans+Tamil:wght@700&display=swap";

// polygonLeft values are the Figma x offsets converted to vw (x / 1440 * 100).
const FRAMES = [
  { id: "intro", duration: 1000, polygonLeft: 72.4, band: false, kind: "logo" },
  { id: "hi", duration: 850, polygonLeft: 44.6, band: false, kind: "lang", title: "प्रज्ञा-1 A", subtitle: "एक क्षेत्रीय चैटबॉट", font: "'Noto Sans Devanagari', sans-serif" },
  { id: "kn", duration: 850, polygonLeft: 22.6, band: true, kind: "lang", title: "ಪ್ರಜ್ಞಾ-1 A", subtitle: "ಒಂದು ಪ್ರಾದೇಶಿಕ ಚಾಟ್‌ಬಾಟ್", font: "'Noto Sans Kannada', sans-serif" },
  { id: "te", duration: 850, polygonLeft: 8.3, band: true, kind: "lang", title: "ప్రజ్ఞ 1 A", subtitle: "ఒక ప్రాంతీయ చాట్‌బాట్", font: "'Noto Sans Telugu', sans-serif" },
  { id: "ta", duration: 850, polygonLeft: -9.3, band: true, kind: "lang", title: "பிரக்ஞா 1 A", subtitle: "ஒரு பிராந்திய சாட்பாட்", font: "'Noto Sans Tamil', sans-serif" },
  { id: "en", duration: 1100, polygonLeft: -18.6, band: true, kind: "pragna" },
  { id: "ending", duration: 800, polygonLeft: -18.75, band: true, kind: "logo" },
  { id: "tagline", duration: 1300, polygonLeft: -40, band: false, kind: "tagline" },
];

// App.jsx imports these so its dismissal timers always match the sequence.
export const SPLASH_TOTAL_MS = FRAMES.reduce((sum, f) => sum + f.duration, 0);
export const SPLASH_FADE_MS = 500;

export default function SplashScreen({ visible = true }) {
  const [frameIndex, setFrameIndex] = useState(0);

  // Load the regional-script fonts once for the whole sequence.
  useEffect(() => {
    const link = document.createElement("link");
    link.href = FONT_URL;
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      try {
        document.head.removeChild(link);
      } catch {
        // already removed
      }
    };
  }, []);

  // Schedule every frame transition up-front against a single time origin.
  useEffect(() => {
    const timers = [];
    let offset = 0;
    for (let i = 1; i < FRAMES.length; i++) {
      offset += FRAMES[i - 1].duration;
      timers.push(setTimeout(() => setFrameIndex(i), offset));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const frame = FRAMES[frameIndex];
  const isTagline = frame.kind === "tagline";
  const isLanguageStage = frameIndex >= 1 && frameIndex <= 5;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#000",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: visible ? 1 : 0,
        transition: `opacity ${SPLASH_FADE_MS}ms ease`,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <style>{`
        @keyframes splashFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes splashTextCrossfade {
          0%   { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Polygon 1 - the gold triangle sweeping left across the sequence */}
      <div
        style={{
          position: "absolute",
          top: "-56.3vh",
          left: `${frame.polygonLeft}vw`,
          width: "104.7vw",
          height: "74.9vh",
          background: GOLD_BAND,
          clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
          opacity: isTagline ? 0 : 1,
          transition: "left 0.75s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.5s ease",
        }}
      />

      {/* Rectangle 1 - top-right band, present from the Kannada frame on */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "41.8vw",
          height: "18.6vh",
          background: GOLD_BAND,
          opacity: frame.band && !isTagline ? 1 : 0,
          transition: "opacity 0.6s ease",
        }}
      />

      {/* Center content - Stages are cleanly decoupled to eliminate re-render glitches */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: "92vw",
          padding: "0 16px",
          boxSizing: "border-box",
        }}
      >
        {/* Stage 1: Intro Logo */}
        {frameIndex === 0 && (
          <div style={{ animation: "splashFadeIn 0.4s ease" }}>
            <img
              src={etherxLogo}
              alt="EtherX Innovations"
              style={{
                width: "clamp(90px, 12vw, 162px)",
                height: "clamp(90px, 12vw, 162px)",
                objectFit: "contain",
                filter: "drop-shadow(0 0 20px rgba(212, 175, 55, 0.35))",
              }}
            />
          </div>
        )}

        {/* Stage 2: Regional Languages (Frames 1 - 5)
            The EtherX logo stays anchored and stable while only the text crossfades smoothly */}
        {isLanguageStage && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "clamp(12px, 2vw, 28px)",
              flexWrap: "nowrap",
              animation: frameIndex === 1 ? "splashFadeIn 0.35s ease" : "none",
            }}
          >
            <img
              src={etherxLogo}
              alt="EtherX"
              style={{
                width: "clamp(72px, 10vw, 150px)",
                height: "clamp(72px, 10vw, 150px)",
                objectFit: "contain",
                filter: "drop-shadow(0 0 20px rgba(212, 175, 55, 0.35))",
                flexShrink: 0,
              }}
            />

            <div
              key={frame.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                minWidth: 0,
                textAlign: "left",
                animation: "splashTextCrossfade 0.22s ease-out",
              }}
            >
              {frame.kind === "lang" && (
                <>
                  <span
                    style={{
                      fontFamily: frame.font,
                      fontWeight: 700,
                      fontSize: "clamp(24px, 4.5vw, 60px)",
                      lineHeight: 1.15,
                      color: GOLD_TITLE,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {frame.title}
                  </span>
                  <span
                    style={{
                      fontFamily: frame.font,
                      fontWeight: 400,
                      fontSize: "clamp(13px, 1.8vw, 24px)",
                      color: "#fff",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {frame.subtitle}
                  </span>
                </>
              )}

              {frame.kind === "pragna" && (
                <>
                  <img
                    src={pragnaWordmark}
                    alt="PRAGNA-1 A"
                    style={{
                      height: "clamp(22px, 3.6vw, 48px)",
                      width: "auto",
                      objectFit: "contain",
                      filter: "drop-shadow(0 0 16px rgba(212, 175, 55, 0.3))",
                      display: "block",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
                      fontWeight: 600,
                      fontSize: "clamp(13px, 1.8vw, 24px)",
                      color: "#fff",
                      whiteSpace: "nowrap",
                      letterSpacing: "0.3px",
                    }}
                  >
                    A regional chatbot
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Stage 3: Ending Logo */}
        {frameIndex === 6 && (
          <div style={{ animation: "splashFadeIn 0.35s ease" }}>
            <img
              src={etherxLogo}
              alt="EtherX Innovations"
              style={{
                width: "clamp(90px, 12vw, 162px)",
                height: "clamp(90px, 12vw, 162px)",
                objectFit: "contain",
                filter: "drop-shadow(0 0 20px rgba(212, 175, 55, 0.35))",
              }}
            />
          </div>
        )}

        {/* Stage 4: Closing Tagline */}
        {frameIndex === 7 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "clamp(12px, 2vw, 24px)",
              flexWrap: "wrap",
              textAlign: "center",
              animation: "splashFadeIn 0.4s ease",
            }}
          >
            <img
              src={etherxLogo}
              alt=""
              style={{
                width: "clamp(72px, 10vw, 150px)",
                height: "clamp(72px, 10vw, 150px)",
                objectFit: "contain",
                filter: "drop-shadow(0 0 20px rgba(212, 175, 55, 0.35))",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
                fontWeight: 700,
                fontSize: "clamp(14px, 2.5vw, 32px)",
                letterSpacing: "0.5px",
                color: GOLD_BAND,
                wordBreak: "break-word",
                maxWidth: "85vw",
              }}
            >
              A PRODUCT OF ETHERX INNOVATIONS
            </span>
          </div>
        )}
      </div>

      {/* Persistent bottom-right wordmark - hidden only on the final frame */}
      <div
        style={{
          position: "absolute",
          right: "clamp(12px, 2.5vw, 36px)",
          bottom: "clamp(12px, 3.5vh, 40px)",
          fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
          fontWeight: 700,
          fontSize: "clamp(11px, 1.8vw, 26px)",
          letterSpacing: "0.5px",
          color: GOLD_BAND,
          opacity: isTagline ? 0 : 1,
          transition: "opacity 0.4s ease",
          zIndex: 2,
          maxWidth: "80vw",
          textAlign: "right",
          pointerEvents: "none",
        }}
      >
        ETHERX INNOVATIONS
      </div>
    </div>
  );
}

