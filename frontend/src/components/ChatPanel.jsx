import { useState, useEffect, useRef } from "react";
import { 
  askQuestion, 
  getChatMessages, 
  clearChatHistory, 
  deleteChatMessage 
} from "../services/api";
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Trash2, 
  X, 
  Search, 
  Clock, 
  Copy,
  AlertCircle,
  HelpCircle,
  Code2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SqlViewer from "./SqlViewer";
import ResultTable from "./ResultTable";
import ChartView from "./ChartView";

function ChatPanel({ workspaceId, setResponse }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const threadEndRef = useRef(null);

  const placeholderSuggestions = [
    "Show sales trend analysis",
    "Run outlier analysis",
    "List top 10 rows",
    "Show average value by category"
  ];

  useEffect(() => {
    if (workspaceId) {
      loadHistory();
    } else {
      setChatLog([]);
    }
  }, [workspaceId]);

  useEffect(() => {
    scrollToBottom();
  }, [chatLog, loading]);

  const loadHistory = async () => {
    try {
      const res = await getChatMessages(workspaceId);
      if (res.status === "success" && res.chat_messages) {
        setChatLog(res.chat_messages);
      }
    } catch (err) {
      console.error("Failed to load chat history", err);
    }
  };

  const scrollToBottom = () => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleAsk = async (customQ = null) => {
    const activeQ = customQ || question;
    if (!activeQ.trim()) return;
    
    setQuestion("");
    setLoading(true);
    
    // Optimistic User Bubble
    const tempUserMsg = {
      role: "user",
      message: activeQ,
      created_at: new Date().toISOString()
    };
    setChatLog((prev) => [...prev, tempUserMsg]);

    try {
      const result = await askQuestion(activeQ);
      if (result) {
        setResponse(result);
      }
      await loadHistory();
    } catch (err) {
      console.error(err);
      setChatLog((prev) => [
        ...prev, 
        { 
          role: "assistant", 
          message: "Error: Failed to process query. Please check database structure or retry.", 
          created_at: new Date().toISOString() 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const confirmClearChat = async () => {
    if (!workspaceId) return;
    try {
      await clearChatHistory(workspaceId);
      setChatLog([]);
      setResponse(null);
      setShowClearConfirm(false);
    } catch (err) {
      console.error("Failed to clear chat", err);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (window.confirm("Delete this message permanently?")) {
      try {
        await deleteChatMessage(msgId);
        setChatLog((prev) => prev.filter((c) => c.id !== msgId));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      const cleanStr = timeStr.includes("Z") || timeStr.includes("T") 
        ? timeStr 
        : timeStr.replace(" ", "T");
      const date = new Date(cleanStr);
      if (isNaN(date.getTime())) return timeStr;
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return timeStr;
    }
  };

  // Inline Regex SQL Syntax Highlighting
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
    
    return <code className="font-mono text-[11px]" dangerouslySetInnerHTML={{ __html: escaped }} />;
  };

  // Custom Markdown Parser with formatting and code copies
  const renderMarkdown = (text) => {
    if (!text) return "";
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith("```")) {
        const match = part.match(/```(\w*)\n([\s\S]*?)```/);
        const language = match ? match[1] : "code";
        const codeContent = match ? match[2] : part.slice(3, -3);
        
        return (
          <div key={index} className="my-2 bg-[#0A0A0B] border border-brand-border rounded-lg overflow-hidden font-mono text-left">
            <div className="flex items-center justify-between px-3 py-1 bg-brand-sidebar text-[9px] text-brand-muted border-b border-brand-border">
              <span className="uppercase font-semibold tracking-wider font-mono flex items-center gap-1">
                <Code2 className="h-3 w-3 text-brand-lime" />
                {language || "code"}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(codeContent.trim());
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-card border border-brand-border hover:bg-brand-card-hover hover:text-white transition-colors text-[9px] cursor-pointer"
                title="Copy code"
              >
                <Copy className="h-2.5 w-2.5" />
                Copy
              </button>
            </div>
            <pre className="p-3 text-[11px] overflow-x-auto leading-relaxed whitespace-pre font-mono bg-brand-bg/40 text-slate-200">
              {language.toLowerCase() === "sql" ? highlightSql(codeContent.trim()) : <code>{codeContent.trim()}</code>}
            </pre>
          </div>
        );
      }
      
      const lines = part.split("\n");
      return lines.map((line, lIdx) => {
        let content = line;
        
        // Match bold **text**
        const boldRegex = /\*\*(.*?)\*\*/g;
        const parsedElements = [];
        let lastIdx = 0;
        let boldMatch;
        while ((boldMatch = boldRegex.exec(content)) !== null) {
          if (boldMatch.index > lastIdx) {
            parsedElements.push(content.substring(lastIdx, boldMatch.index));
          }
          parsedElements.push(
            <strong key={boldMatch.index} className="font-extrabold text-white">
              {boldMatch[1]}
            </strong>
          );
          lastIdx = boldRegex.lastIndex;
        }
        if (lastIdx < content.length) {
          parsedElements.push(content.substring(lastIdx));
        }

        if (line.trim().startsWith("* ") || line.trim().startsWith("- ")) {
          return (
            <li key={lIdx} className="list-disc list-inside ml-2 my-1.5 text-brand-muted text-[11px]">
              {parsedElements.length > 0 ? parsedElements : line.trim().substring(2)}
            </li>
          );
        }

        return (
          <p key={lIdx} className="my-1.5 leading-relaxed text-brand-muted text-[11px] min-h-[1.2em]">
            {parsedElements.length > 0 ? parsedElements : line}
          </p>
        );
      });
    });
  };

  const filteredChatLog = chatLog.filter(msg => 
    msg.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.sql_query?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="glass-panel p-5 border border-brand-border flex flex-col h-[500px] lg:h-[620px] w-full relative overflow-hidden shrink-0">
      
      {/* Header Panel */}
      <div className="flex items-center justify-between mb-4 border-b border-brand-border pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-brand-lime/10 border border-brand-lime/20 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-brand-lime" />
          </div>
          <div>
            <h2 className="text-xs font-black text-white uppercase tracking-wider">
              AI Analytics Console
            </h2>
            <p className="text-[9px] text-brand-dimmed font-medium">ChatGPT Workspace Assistant</p>
          </div>
        </div>
        
        {workspaceId && chatLog.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-brand-dimmed" />
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-brand-input border border-brand-border text-[10px] rounded-lg pl-8 pr-3 py-1 text-slate-200 placeholder-brand-dimmed focus:outline-none focus:border-brand-lime/55 w-32 sm:w-44 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-brand-dimmed hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="w-[1px] h-4 bg-brand-border mx-1" />
            
            <button
              onClick={() => setShowClearConfirm(true)}
              className="p-1 rounded text-brand-error hover:bg-brand-error/10 border border-brand-error/20 bg-brand-error/5 hover:text-red-400 transition-colors flex items-center gap-1 text-[10px] cursor-pointer"
              title="Clear Chat History"
            >
              <Trash2 className="h-3 w-3" />
              Clear Chat
            </button>
          </div>
        )}
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 scroll-smooth min-h-0 flex flex-col p-0.5">
        {filteredChatLog.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-brand-dimmed gap-3 py-16">
            <div className="h-10 w-10 rounded-2xl border border-brand-border flex items-center justify-center bg-brand-card">
              <HelpCircle className="h-5 w-5 text-brand-lime animate-bounce" />
            </div>
            <div className="text-center">
              <p className="text-xs font-black text-white uppercase tracking-wider">
                {searchQuery ? "No matching logs found" : "Workspace Intelligence Console"}
              </p>
              <p className="text-[10px] text-brand-dimmed mt-1 max-w-xs px-3 mx-auto leading-relaxed font-medium">
                {searchQuery 
                  ? "Try checking keyword details or clear search terms." 
                  : "Ask sales questions, request statistical charts, or apply automated analysis actions below."}
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredChatLog.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex gap-3 w-full ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {/* Bot Avatar */}
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-brand-card border border-brand-lime/45 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(184,255,44,0.15)] mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-brand-lime" />
                  </div>
                )}

                <div
                  className={`flex flex-col gap-1 max-w-[85%] sm:max-w-[78%] ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {/* Bubble Container */}
                  <div
                    className={`rounded-2xl px-4 py-3 text-xs leading-relaxed transition-all shadow-xl border ${
                      msg.role === "user"
                        ? "bg-brand-card border-brand-lime text-white rounded-tr-none shadow-[0_0_15px_rgba(184,255,44,0.06)]"
                        : "bg-brand-card border-brand-border text-slate-200 rounded-tl-none flex flex-col gap-3 w-full"
                    }`}
                  >
                    {/* Message Text */}
                    <div className="whitespace-pre-wrap">
                      {msg.role === "user" ? msg.message : renderMarkdown(msg.message)}
                    </div>

                    {/* Rendering Visual Cards inside Assistant response */}
                    {msg.role === "assistant" && (
                      <div className="flex flex-col gap-3.5 w-full mt-1 empty:hidden">
                        {msg.sql_query && (
                          <div className="border border-brand-border/60 rounded-lg overflow-hidden shrink-0">
                            <SqlViewer sql={msg.sql_query} />
                          </div>
                        )}
                        
                        {msg.result && msg.result.length > 0 && (
                          <div className="border border-brand-border/60 rounded-lg overflow-hidden shrink-0">
                            <ResultTable data={msg.result} />
                          </div>
                        )}

                        {msg.chart && (
                          <div className="border border-brand-border/60 rounded-lg overflow-hidden shrink-0">
                            <ChartView chart={msg.chart} resultsData={msg.result} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Timestamp & message operations */}
                  <div className="flex items-center gap-2 px-1.5 mt-0.5">
                    <span className="text-[8px] text-brand-dimmed flex items-center gap-1 font-mono">
                      <Clock className="h-2.5 w-2.5 text-brand-lime" />
                      {formatTime(msg.created_at)}
                    </span>
                    
                    {msg.role === "assistant" && msg.id && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="text-[8px] text-brand-error hover:text-red-400 font-bold cursor-pointer"
                        title="Delete query thread"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* User Avatar */}
                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-full bg-brand-input border border-brand-border flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-brand-muted" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Loading Spinner / Typing Shimmer */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="h-7 w-7 rounded-full bg-brand-card border border-brand-lime/30 flex items-center justify-center shrink-0 animate-pulse">
              <Bot className="h-3.5 w-3.5 text-brand-lime" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="bg-brand-card border border-brand-border rounded-2xl rounded-tl-none px-4 py-3 text-xs flex items-center gap-1.5 shadow-md">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-lime animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-brand-lime animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-brand-lime animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-[8px] text-brand-dimmed px-1 font-bold tracking-wider uppercase">AI is analyzing database...</span>
            </div>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Suggestion Chips Above Input */}
      {workspaceId && !loading && (
        <div className="flex items-center gap-1.5 flex-wrap px-1 mb-2">
          {placeholderSuggestions.map((sug, i) => (
            <button
              key={i}
              onClick={() => handleAsk(sug)}
              className="text-[9px] font-bold px-2.5 py-1 rounded-full border border-brand-border bg-brand-card text-brand-muted hover:border-brand-lime hover:text-white transition-all cursor-pointer shadow-sm hover:shadow-[0_0_10px_rgba(184,255,44,0.06)]"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* Rounded Search-Style Input Zone */}
      <div className="flex gap-2 shrink-0 border-t border-brand-border pt-3 mt-auto bg-brand-bg/85 backdrop-blur-sm relative z-10">
        <textarea
          rows="1"
          placeholder="Ask a sales question, trend, or run custom SQL analysis..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
          className="flex-1 bg-brand-input border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-brand-dimmed focus:outline-none focus:border-brand-lime focus:ring-1 focus:ring-brand-lime/15 resize-none min-h-[40px] max-h-[100px] leading-relaxed transition-all"
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleAsk()}
          disabled={!question.trim() || loading}
          className="bg-brand-lime hover:bg-brand-lime-hover disabled:bg-brand-input disabled:text-brand-dimmed border border-brand-border disabled:border-brand-border text-black disabled:text-brand-dimmed rounded-xl px-4 flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed shadow-[0_0_12px_rgba(184,255,44,0.15)] disabled:shadow-none"
        >
          <Send className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Confirmation Dialog for Clear Chat */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-[#17171A] border border-brand-border w-full max-w-sm rounded-xl shadow-2xl p-5 relative">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="absolute top-3 right-3 text-brand-muted hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-brand-error shrink-0" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Clear Chat History?
              </h3>
            </div>

            <p className="text-[11px] text-brand-muted mb-5 leading-relaxed font-medium">
              This action cannot be undone. All conversation records in this workspace will be deleted permanently.
            </p>

            <div className="flex gap-3">
              <button
                onClick={confirmClearChat}
                className="flex-1 bg-brand-error hover:bg-red-550 text-white font-bold py-2 rounded-lg transition-colors text-xs cursor-pointer"
              >
                Clear History
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 bg-[#1F1F24] border border-brand-border hover:bg-[#2A2A2F] text-brand-muted font-bold py-2 rounded-lg transition-colors text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatPanel;