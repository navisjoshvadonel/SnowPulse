"use client";

import React, { useState } from "react";
import { Users, UserPlus, X, Shield, Mail, CheckCircle2, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Analyst" | "Viewer";
  status: "Active" | "Pending";
  avatar: string;
}

interface TeamAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TeamAccessModal({ isOpen, onClose }: TeamAccessModalProps) {
  const [members, setMembers] = useState<Member[]>([
    { id: "1", name: "Executive Admin", email: "user@snowpulse.ai", role: "Admin", status: "Active", avatar: "EA" },
    { id: "2", name: "Sarah Connor", email: "sarah@snowpulse.ai", role: "Analyst", status: "Active", avatar: "SC" },
    { id: "3", name: "Alex Rivera", email: "arivera@snowpulse.ai", role: "Viewer", status: "Pending", avatar: "AR" },
  ]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Admin" | "Analyst" | "Viewer">("Analyst");
  const [invitedSuccess, setInvitedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    const newMember: Member = {
      id: Date.now().toString(),
      name: inviteEmail.split("@")[0],
      email: inviteEmail,
      role: inviteRole,
      status: "Pending",
      avatar: inviteEmail.slice(0, 2).toUpperCase(),
    };

    setMembers([...members, newMember]);
    setInviteEmail("");
    setInvitedSuccess(true);
    setTimeout(() => setInvitedSuccess(false), 3000);
  };

  const handleRemove = (id: string) => {
    setMembers(members.filter((m) => m.id !== id));
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
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Team & Organization Access</h3>
                <p className="text-xs text-white/40">Manage collaborators, roles, and dataset access permissions.</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>

          {/* Invite Form */}
          <form onSubmit={handleInvite} className="flex gap-2.5 mb-6">
            <div className="relative flex-1">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e: any) => setInviteRole(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer font-sans"
            >
              <option value="Admin" className="bg-[#12151e]">Admin</option>
              <option value="Analyst" className="bg-[#12151e]">Analyst</option>
              <option value="Viewer" className="bg-[#12151e]">Viewer</option>
            </select>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              <UserPlus size={15} /> Invite
            </button>
          </form>

          {invitedSuccess && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 size={15} /> Invitation sent successfully!
            </motion.div>
          )}

          {/* Members List */}
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            <p className="text-[11px] text-white/40 font-mono uppercase tracking-wider mb-2">Active Workspace Members ({members.length})</p>
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                    {m.avatar}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white flex items-center gap-2">
                      {m.name}
                      {m.status === "Pending" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">Pending</span>
                      )}
                    </p>
                    <p className="text-[11px] text-white/40">{m.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/60 font-mono bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 flex items-center gap-1.5">
                    <Shield size={12} className="text-indigo-400" /> {m.role}
                  </span>
                  {m.role !== "Admin" && (
                    <button onClick={() => handleRemove(m.id)} className="p-1.5 text-white/20 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer" title="Remove member">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
