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

  // Custom Inline Regex SQL syntax highlighter
  const highlightSql = (sqlText) => {
    if (!sqlText) return "";
    let escaped = sqlText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    const keywords = [
      "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "LIMIT", "JOIN", 
      "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "ON", "AND", "OR", "AS", 
      "WITH", "HAVING", "UNION", "ALL", "IN", "NOT", "LIKE", "IS", "NULL", 
      "DESC", "ASC", "OVER", "PARTITION BY", "CASE", "WHEN", "THEN", "ELSE", "END"
    ];
    
    const functions = [
      "COUNT", "SUM", "AVG", "MAX", "MIN", "COALESCE", "ROUND", "CONCAT", 
      "DATE", "NOW", "YEAR", "MONTH", "DAY", "ROW_NUMBER", "RANK", "DENSE_RANK"
    ];

    escaped = escaped.replace(/('[^']*')/g, '<span class="text-yellow-400">$1</span>');
    escaped = escaped.replace(/\b(\d+)\b/g, '<span class="text-purple-400">$1</span>');

    keywords.forEach(kw => {
      const regex = new RegExp(`\\b(${kw})\\b`, "gi");
      escaped = escaped.replace(regex, '<span class="text-brand-lime font-bold">$1</span>');
    });

    functions.forEach(fn => {
      const regex = new RegExp(`\\b(${fn})\\b`, "gi");
      escaped = escaped.replace(regex, '<span class="text-sky-400 font-semibold">$1</span>');
    });
    
    return <code dangerouslySetInnerHTML={{ __html: escaped }} />;
  };

  return (
    <div className="glass-panel p-5 border border-brand-border bg-brand-card/45">
      <div className="flex items-center justify-between mb-3 border-b border-brand-border/60 pb-2">
        <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Terminal className="h-4 w-4 text-brand-lime" />
          Generated SQL Query
        </h3>
        <button
          onClick={handleCopy}
          className="text-[10px] text-brand-muted hover:text-white flex items-center gap-1.5 bg-brand-input border border-brand-border px-2.5 py-1 rounded-md transition-all cursor-pointer shadow-sm"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-brand-success" />
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

      <pre className="bg-[#0A0A0B] p-4 rounded-lg overflow-x-auto border border-brand-border text-slate-200 text-xs font-mono select-all leading-relaxed max-h-[180px]">
        {highlightSql(sql)}
      </pre>
    </div>
  );
}

export default SqlViewer;