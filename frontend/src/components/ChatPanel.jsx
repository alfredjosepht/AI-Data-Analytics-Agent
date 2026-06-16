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
  AlertCircle 
} from "lucide-react";
import SqlViewer from "./SqlViewer";
import ResultTable from "./ResultTable";
import ChartView from "./ChartView";

function ChatPanel({ workspaceId, setResponse }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Custom Confirmation Modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const threadEndRef = useRef(null);

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

  const handleAsk = async () => {
    if (!question.trim()) return;
    const userQ = question;
    setQuestion("");
    setLoading(true);
    
    // Add optimistic user message
    const tempUserMsg = {
      role: "user",
      message: userQ,
      created_at: new Date().toISOString()
    };
    setChatLog((prev) => [...prev, tempUserMsg]);

    try {
      const result = await askQuestion(userQ);
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
          message: "Error: Failed to process query.", 
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

  // Custom Markdown parser supporting code blocks, bold text, lists, and copy action
  const renderMarkdown = (text) => {
    if (!text) return "";
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith("```")) {
        const match = part.match(/```(\w*)\n([\s\S]*?)```/);
        const language = match ? match[1] : "code";
        const codeContent = match ? match[2] : part.slice(3, -3);
        
        return (
          <div key={index} className="my-2 bg-[#05070c] border border-slate-850 rounded-lg overflow-hidden font-mono text-left">
            <div className="flex items-center justify-between px-3 py-1 bg-slate-950 text-[9px] text-slate-400 border-b border-slate-850">
              <span className="uppercase font-semibold tracking-wider font-mono">{language || "code"}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(codeContent.trim());
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors text-[9px]"
                title="Copy code"
              >
                <Copy className="h-2.5 w-2.5" />
                Copy
              </button>
            </div>
            <pre className="p-3 text-[11px] text-emerald-450 overflow-x-auto leading-relaxed whitespace-pre font-mono bg-slate-950/60">
              <code>{codeContent.trim()}</code>
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
            <strong key={boldMatch.index} className="font-bold text-white">
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
            <li key={lIdx} className="list-disc list-inside ml-2 my-0.5 text-slate-350 text-[11px]">
              {parsedElements.length > 0 ? parsedElements : line.trim().substring(2)}
            </li>
          );
        }

        return (
          <p key={lIdx} className="my-1 leading-relaxed text-slate-300 text-[11px] min-h-[1em]">
            {parsedElements.length > 0 ? parsedElements : line}
          </p>
        );
      });
    });
  };

  // Filter messages based on search query
  const filteredChatLog = chatLog.filter(msg => 
    msg.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.sql_query?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="glass-panel p-5 border border-slate-800/80 flex flex-col h-[620px] relative overflow-hidden shrink-0">
      
      {/* Header Panel */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              AI Analytics Console
            </h2>
            <p className="text-[9px] text-slate-500 font-medium">ChatGPT Workspace Assistant</p>
          </div>
        </div>
        
        {workspaceId && chatLog.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Search Input inside chat */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3 w-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-850 text-[10px] rounded-lg pl-7 pr-3 py-1 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 w-32 sm:w-44 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="w-[1px] h-3.5 bg-slate-900 mx-1" />
            
            <button
              onClick={() => setShowClearConfirm(true)}
              className="p-1 rounded text-red-400/85 hover:bg-red-500/10 transition-colors flex items-center gap-1 text-[10px] border border-red-500/10 bg-red-950/5 hover:text-red-300"
              title="Clear Chat History"
            >
              <Trash2 className="h-3 w-3" />
              Clear Chat
            </button>
          </div>
        )}
      </div>

      {/* Chat messages thread */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 scroll-smooth min-h-0 flex flex-col p-0.5">
        {filteredChatLog.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3 py-16">
            <Bot className="h-9 w-9 text-slate-700 animate-pulse" />
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-400">
                {searchQuery ? "No matching messages found." : "Workspace Chat Active"}
              </p>
              <p className="text-[10px] text-slate-500 mt-1 max-w-xs px-2 mx-auto leading-relaxed">
                {searchQuery 
                  ? "Try checking spelling or use a different keyword query." 
                  : "Ask questions like 'Show total sales by segment', 'What is the top category?', or run custom data analysis."}
              </p>
            </div>
          </div>
        ) : (
          filteredChatLog.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3.5 w-full ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {/* Bot Avatar */}
              {msg.role === "assistant" && (
                <div className="h-7 w-7 rounded-full bg-indigo-950 border border-indigo-700/40 flex items-center justify-center shrink-0 shadow shadow-indigo-500/5 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-indigo-400" />
                </div>
              )}

              <div
                className={`flex flex-col gap-1.5 max-w-[85%] sm:max-w-[80%] ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* Bubble Container */}
                <div
                  className={`rounded-2xl px-4 py-3 text-xs leading-relaxed transition-all shadow border ${
                    msg.role === "user"
                      ? "bg-blue-600 border-blue-500 text-white rounded-tr-none"
                      : "bg-[#0b0f19]/90 border-slate-850 text-slate-200 rounded-tl-none flex flex-col gap-3"
                  }`}
                >
                  {/* Message Body */}
                  <div className="whitespace-pre-wrap">
                    {msg.role === "user" ? msg.message : renderMarkdown(msg.message)}
                  </div>

                  {/* Render Visual Blocks Inside Assistant Message */}
                  {msg.role === "assistant" && (
                    <div className="flex flex-col gap-3.5 w-full mt-2 empty:hidden">
                      {msg.sql_query && (
                        <div className="border border-slate-850/50 rounded-lg overflow-hidden shrink-0">
                          <SqlViewer sql={msg.sql_query} />
                        </div>
                      )}
                      
                      {msg.result && msg.result.length > 0 && (
                        <div className="border border-slate-850/50 rounded-lg overflow-hidden shrink-0">
                          <ResultTable data={msg.result} />
                        </div>
                      )}

                      {msg.chart && (
                        <div className="border border-slate-850/50 rounded-lg overflow-hidden shrink-0">
                          <ChartView chart={msg.chart} resultsData={msg.result} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer and timestamp */}
                <div className="flex items-center gap-1.5 px-1.5">
                  <span className="text-[8px] text-slate-550 flex items-center gap-1 font-medium">
                    <Clock className="h-2.5 w-2.5" />
                    {formatTime(msg.created_at)}
                  </span>
                  
                  {msg.role === "assistant" && msg.id && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="text-[8px] text-red-500 hover:text-red-400 font-semibold cursor-pointer"
                      title="Delete query pair"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* User Avatar */}
              {msg.role === "user" && (
                <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 shadow shadow-slate-500/5 mt-0.5">
                  <User className="h-3.5 w-3.5 text-slate-300" />
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading / Typing indicator */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="h-7 w-7 rounded-full bg-indigo-955 border border-indigo-900/30 flex items-center justify-center shrink-0 animate-pulse">
              <Bot className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="bg-[#0b0f19]/70 border border-slate-850 rounded-2xl rounded-tl-none px-4 py-3 text-xs flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-[8px] text-slate-550 px-1 font-semibold">AI is compiling SQL...</span>
            </div>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Input zone */}
      <div className="flex gap-2 shrink-0 border-t border-slate-900 pt-3 mt-auto bg-[#080b11]/80 backdrop-blur-sm relative z-10">
        <textarea
          rows="1"
          placeholder="Ask a question about this workspace dataset..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
          className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 resize-none min-h-[40px] max-h-[100px] leading-relaxed transition-all"
        />
        <button
          onClick={handleAsk}
          disabled={!question.trim() || loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-900 disabled:text-slate-600 text-white rounded-xl px-4 flex items-center justify-center shrink-0 transition-colors shadow-lg shadow-blue-500/10 cursor-pointer disabled:cursor-not-allowed"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Custom Confirmation Dialog for Clear Chat */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 w-full max-w-sm rounded-xl shadow-2xl p-5 relative">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Clear Chat History?
              </h3>
            </div>

            <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
              This action cannot be undone. All conversation records in this workspace will be deleted permanently.
            </p>

            <div className="flex gap-3">
              <button
                onClick={confirmClearChat}
                className="flex-1 bg-red-650 hover:bg-red-550 text-white font-semibold py-2 rounded-lg transition-colors text-xs cursor-pointer"
              >
                Clear Chat
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-350 font-semibold py-2 rounded-lg transition-colors text-xs cursor-pointer"
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