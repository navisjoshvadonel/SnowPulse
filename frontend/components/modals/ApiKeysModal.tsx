"use client";

import React, { useState } from "react";
import { Key, Database, Webhook, X, Copy, Check, Eye, EyeOff, Plus, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiKeysModal({ isOpen, onClose }: ApiKeysModalProps) {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [geminiKey, setGeminiKey] = useState("AIzaSyD-EXAMPLE-GEMINI-3.6-FLASH-KEY");
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(geminiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl rounded-2xl p-6 overflow-hidden relative"
          style={{ background: "#12151e", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Key size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">API Keys & Integrations</h3>
                <p className="text-xs text-white/40">Manage Gemini API keys, Snowflake endpoints, and webhook connections.</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-5">
            {/* Gemini Key Config */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white flex items-center gap-2">
                  <ShieldCheck size={16} className="text-cyan-400" /> Primary Gemini 3.6 Flash API Key
                </label>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active</span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? "text" : "password"}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="w-full pr-10 pl-3 py-2 text-xs bg-black/40 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} Copy
                </button>
              </div>
            </div>

            {/* Integrations Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <Database size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Snowflake DB</p>
                    <p className="text-[10px] text-white/40">Warehouse Sync</p>
                  </div>
                </div>
                <span className="text-[10px] text-white/40 font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">Connected</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <Webhook size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Anomaly Webhooks</p>
                    <p className="text-[10px] text-white/40">Slack & PagerDuty</p>
                  </div>
                </div>
                <button className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 cursor-pointer">
                  Configure
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
              {savedSuccess ? (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                  <Check size={14} /> Key configuration saved!
                </span>
              ) : (
                <span className="text-[11px] text-white/30 font-mono">Encrypted via AES-256 in production environment</span>
              )}
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-lg shadow-cyan-600/20"
              >
                Save Integration Settings
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
