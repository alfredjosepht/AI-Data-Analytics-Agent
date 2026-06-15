import { useState } from "react";
import { askQuestion } from "../services/api";
import { MessageSquare, Send, Bot, User, CheckCircle2 } from "lucide-react";

function ChatPanel({ setResponse }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLog, setChatLog] = useState([]);

  const handleAsk = async () => {
    if (!question) return;
    const userQ = question;
    setQuestion("");
    setLoading(true);
    
    setChatLog((prev) => [...prev, { sender: "user", text: userQ }]);

    try {
      const result = await askQuestion(userQ);
      setResponse(result);
      
      setChatLog((prev) => [
        ...prev, 
        { 
          sender: "agent", 
          text: result.answer,
          hits: result.hits || null
        }
      ]);
    } catch (err) {
      console.error(err);
      setChatLog((prev) => [...prev, { sender: "agent", text: "Error: Failed to process query." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 border border-slate-800 flex flex-col h-[520px]">
      <h2 className="text-lg font-bold mb-3 text-gradient flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-blue-500" />
        AI Data Console
      </h2>

      {/* Chat Thread */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scroll-smooth">
        {chatLog.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <Bot className="h-10 w-10 text-slate-600" />
            <p className="text-sm font-medium">Ask sales analysis, trends, or Q&A...</p>
          </div>
        ) : (
          chatLog.map((chat, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${chat.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {chat.sender === "agent" && (
                <div className="h-7 w-7 rounded-full bg-blue-900/40 border border-blue-700/50 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-blue-400" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs ${
                  chat.sender === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{chat.text}</p>
                
                {/* RAG Source Citations */}
                {chat.hits && chat.hits.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                    <p className="font-semibold mb-1 flex items-center gap-1 text-blue-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Document Citations:
                    </p>
                    <ul className="space-y-1">
                      {chat.hits.map((hit, hIdx) => (
                        <li key={hIdx} className="bg-slate-950/50 p-1.5 rounded border border-slate-900 leading-normal">
                          <span className="font-medium text-slate-300">[Block {hIdx + 1}]</span>: {hit.substring(0, 150)}...
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {chat.sender === "user" && (
                <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-slate-300" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="h-7 w-7 rounded-full bg-blue-950 flex items-center justify-center shrink-0 animate-pulse">
              <Bot className="h-4 w-4 text-blue-400" />
            </div>
            <div className="bg-slate-900 border border-slate-800 text-slate-400 rounded-xl px-4 py-2.5 text-xs rounded-bl-none flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* Input zone */}
      <div className="flex gap-2">
        <textarea
          rows="1"
          placeholder="Type question and press enter..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
          className="flex-1 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none min-h-[38px] max-h-[100px]"
        />
        <button
          onClick={handleAsk}
          disabled={!question || loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg px-3 flex items-center justify-center shrink-0 transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default ChatPanel;