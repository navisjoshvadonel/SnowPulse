"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Send, Bot, User, Loader2 } from "lucide-react";

const placeholders = [
  "What is the root cause of the API latency spike?",
  "Show me ingestion anomalies for the last 24 hours.",
  "Which datasets are failing to sync most frequently?"
];

export default function AiQueryPanel() {
  const [query, setQuery] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  
  // Typewriter effect for placeholder
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const currentText = placeholders[placeholderIdx];
    
    if (isTyping) {
      if (displayedPlaceholder.length < currentText.length) {
        timeout = setTimeout(() => {
          setDisplayedPlaceholder(currentText.slice(0, displayedPlaceholder.length + 1));
        }, 50);
      } else {
        timeout = setTimeout(() => setIsTyping(false), 2000); // pause at end
      }
    } else {
      if (displayedPlaceholder.length > 0) {
        timeout = setTimeout(() => {
          setDisplayedPlaceholder(displayedPlaceholder.slice(0, -1));
        }, 20);
      } else {
        setPlaceholderIdx((prev) => (prev + 1) % placeholders.length);
        setIsTyping(true);
      }
    }
    
    return () => clearTimeout(timeout);
  }, [displayedPlaceholder, isTyping, placeholderIdx]);

  const handleSubmit = async (e?: React.FormEvent, presetQuery?: string) => {
    if (e) e.preventDefault();
    const finalQuery = presetQuery || query;
    if (!finalQuery.trim()) return;

    setQuery(finalQuery);
    setIsSubmitting(true);
    setResponse(null);

    // Simulate SSE streaming response
    try {
      // In a real scenario, this would be a fetch with ReadableStream or EventSource
      // const res = await fetch('/api/ai/query', { method: 'POST', body: JSON.stringify({ prompt: finalQuery }) });
      
      let simulatedResponse = `Analyzing systems for: "${finalQuery}"...\n\n`;
      setResponse(simulatedResponse);
      
      const parts = [
        "Based on recent telemetry, ",
        "the worker queue has 142 pending jobs ",
        "which is a 12% increase from the baseline. ",
        "However, API latency remains stable at 42ms p50. ",
        "No critical anomalies detected in the last 24h window."
      ];
      
      for (let i = 0; i < parts.length; i++) {
        await new Promise(r => setTimeout(r, 600)); // simulate network delay per chunk
        simulatedResponse += parts[i];
        setResponse(simulatedResponse);
      }
    } catch (err) {
      setResponse("Failed to communicate with AI core.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="w-full glass-panel bg-[#0a0a0f]/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 relative overflow-hidden group shadow-2xl shadow-blue-900/10 transition-all hover:border-white/20">
        
        {/* Ambient glow behind the input */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[150%] bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-cyan-500/5 blur-[40px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />

        <div className="relative z-10 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold tracking-tight">Ask SnowPulse AI</h2>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/50">
            <span>Powered by</span>
            <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">Gemini</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="relative z-10">
          <div className="relative flex items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={displayedPlaceholder}
              className="w-full h-[52px] bg-[#12141c]/80 border border-white/10 rounded-xl pl-4 pr-14 text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all shadow-inner text-[15px]"
              disabled={isSubmitting}
            />
            <button 
              type="submit" 
              disabled={!query.trim() || isSubmitting}
              className="absolute right-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </form>

        <div className="relative z-10 mt-4 flex items-center gap-3">
          <span className="text-xs text-white/40 font-medium">Suggestions:</span>
          <button 
            onClick={() => handleSubmit(undefined, "Summarize system health")}
            className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/70 hover:text-white transition-all cursor-pointer whitespace-nowrap"
          >
            Summarize system health
          </button>
          <button 
            onClick={() => handleSubmit(undefined, "Why did vector index size increase?")}
            className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/70 hover:text-white transition-all cursor-pointer whitespace-nowrap hidden sm:block"
          >
            Why did vector index size increase?
          </button>
        </div>
      </div>

      {/* Results Panel */}
      {(isSubmitting || response) && (
        <div className="w-full glass-panel bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 flex gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mt-1">
            <Bot className="w-4 h-4 text-violet-400" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">SnowPulse AI</span>
              {isSubmitting && !response && <span className="text-xs text-violet-400 font-mono animate-pulse">Thinking...</span>}
            </div>
            
            <div className="text-[14px] leading-relaxed text-white/80 font-sans whitespace-pre-wrap">
              {response || (
                <div className="space-y-2 mt-2">
                  <div className="h-4 bg-white/5 rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-white/5 rounded w-1/2 animate-pulse" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
