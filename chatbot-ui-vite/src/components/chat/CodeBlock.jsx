import { useState } from "react";
import { CopyIcon, CheckIcon } from "../icons/PragnaIcon";

export default function CodeBlock({ code, language = "python" }) {
  const [copied, setCopied] = useState(false);

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
  };

  const displayLang = languageMap[language.toLowerCase()] || language.toLowerCase() || "code";

  return (
    <div className="rounded-[14px] overflow-hidden border border-border shadow-premium-md">
      <div className="flex items-center justify-between px-4 py-[9px] bg-surface-subtle border-b border-border">
        <span
          className="text-[12px] font-semibold uppercase tracking-[0.8px]"
          style={{ color: "var(--pragna-gold)" }}
        >
          {displayLang}
        </span>
        <button
          className="flex items-center gap-1.5 rounded-[7px] border border-border bg-transparent px-[11px] py-1 text-[12px] transition-colors duration-150 text-[color:var(--pragna-text-muted)] hover:text-accent-400 hover:border-accent-500/35"
          onClick={copyToClipboard}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </button>
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
