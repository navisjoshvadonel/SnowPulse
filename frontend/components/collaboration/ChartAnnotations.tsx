"use client";

import React, { useState } from "react";
import { MessageSquare, Plus, Check } from "lucide-react";

interface CommentItem {
  id: string;
  user: string;
  text: string;
  time: string;
}

export default function ChartAnnotations() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [comments, setComments] = useState<CommentItem[]>([
    { id: "1", user: "Enterprise Admin", text: "Verified peak intake driver for Q2 forecast.", time: "12m ago" },
  ]);

  const addComment = () => {
    if (!input.trim()) return;
    setComments([
      ...comments,
      { id: Date.now().toString(), user: "Enterprise Admin", text: input.trim(), time: "Just now" },
    ]);
    setInput("");
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono text-white/70 transition-colors cursor-pointer"
      >
        <MessageSquare size={12} className="text-cyan-400" />
        <span>Comments ({comments.length})</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 z-40 w-72 p-3 rounded-xl bg-[#12151e] border border-white/10 shadow-2xl space-y-2.5">
          <div className="text-[11px] font-bold text-white border-b border-white/[0.08] pb-1.5 flex items-center justify-between">
            <span>Chart Annotations</span>
            <span className="text-[9px] font-mono text-white/40">Shared Team Workspace</span>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-indigo-300">{c.user}</span>
                  <span className="font-mono text-white/30">{c.time}</span>
                </div>
                <p className="text-[11px] text-white/80">{c.text}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-1.5 pt-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Add annotation..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && addComment()}
            />
            <button onClick={addComment} className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
