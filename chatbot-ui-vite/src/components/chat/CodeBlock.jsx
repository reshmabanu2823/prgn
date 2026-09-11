import { useState, useContext } from "react";
import { CopyIcon, CheckIcon } from "../icons/PragnaIcon";
import { ChatContext } from "../../context/ChatContext";
import { Eye } from "lucide-react";

export default function CodeBlock({ code, language = "python" }) {
  const [copied, setCopied] = useState(false);
  const { openArtifact } = useContext(ChatContext) || {};

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const languageMap = {
    python: "py",
    javascript: "js",
    jsx: "jsx",
    typescript: "ts",
    tsx: "tsx",
    html: "html",
    css: "css",
    sql: "sql",
    bash: "bash",
    shell: "sh",
    json: "json",
    markdown: "md",
    svg: "svg",
  };

  const lowerLang = (language || "").toLowerCase();
  const displayLang = languageMap[lowerLang] || lowerLang || "code";

  const handleOpenArtifact = () => {
    if (!openArtifact) return;
    openArtifact({
      title: `${displayLang.toUpperCase()} Artifact`,
      content: code,
      language: lowerLang,
    });
  };

  return (
    <div className="rounded-[14px] overflow-hidden border border-border shadow-premium-md my-3">
      <div className="flex items-center justify-between px-4 py-[9px] bg-surface-subtle border-b border-border">
        <span
          className="text-[12px] font-semibold uppercase tracking-[0.8px]"
          style={{ color: "var(--pragna-gold)" }}
        >
          {displayLang}
        </span>
        <div className="flex items-center gap-2">
          {openArtifact && (
            <button
              className="flex items-center gap-1.5 rounded-[7px] border border-border bg-transparent px-[10px] py-1 text-[12px] transition-colors duration-150 text-[color:var(--pragna-text-muted)] hover:text-[var(--pragna-gold)] hover:border-[var(--pragna-gold)]/40 hover:bg-[rgba(212,175,55,0.08)] cursor-pointer"
              onClick={handleOpenArtifact}
              title="Open in Split-View Artifact Panel"
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
          )}
          <button
            className="flex items-center gap-1.5 rounded-[7px] border border-border bg-transparent px-[11px] py-1 text-[12px] transition-colors duration-150 text-[color:var(--pragna-text-muted)] hover:text-accent-400 hover:border-accent-500/35 cursor-pointer"
            onClick={copyToClipboard}
            title={copied ? "Copied!" : "Copy code"}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
      <pre
        className={`m-0 overflow-x-auto px-[18px] py-4 font-mono text-[13.5px] leading-[1.6] language-${language}`}
        style={{ background: "#101010", color: "#e8dcc0" }}
      >
        <code className="font-inherit text-inherit bg-transparent p-0">{code}</code>
      </pre>
    </div>
  );
}
