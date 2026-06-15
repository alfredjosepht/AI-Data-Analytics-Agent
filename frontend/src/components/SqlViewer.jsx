import { useState } from "react";
import { Terminal, Copy, Check } from "lucide-react";

function SqlViewer({ sql }) {
  const [copied, setCopied] = useState(false);

  if (!sql) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel p-5 border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-blue-400" />
          Generated SQL Query
        </h3>
        <button
          onClick={handleCopy}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-1 rounded transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-400" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>

      <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-900 text-slate-200 text-xs font-mono select-all leading-relaxed">
        <code>{sql}</code>
      </pre>
    </div>
  );
}

export default SqlViewer;