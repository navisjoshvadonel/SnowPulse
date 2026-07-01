import React from "react";

export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 z-0 bg-[#0a0a0f] overflow-hidden pointer-events-none">
      {/* Blob 1: Blue */}
      <div 
        className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#3b82f6] opacity-15 blur-[120px] rounded-full mix-blend-screen motion-safe:animate-[drift_25s_ease-in-out_infinite_alternate]"
        style={{ animationDelay: '0s' }}
      />
      
      {/* Blob 2: Violet */}
      <div 
        className="absolute top-[20%] right-[-5%] w-[600px] h-[600px] bg-[#8b5cf6] opacity-15 blur-[120px] rounded-full mix-blend-screen motion-safe:animate-[drift_30s_ease-in-out_infinite_alternate]"
        style={{ animationDelay: '-5s' }}
      />
      
      {/* Blob 3: Cyan */}
      <div 
        className="absolute bottom-[-15%] left-[20%] w-[600px] h-[600px] bg-[#06b6d4] opacity-15 blur-[120px] rounded-full mix-blend-screen motion-safe:animate-[drift_20s_ease-in-out_infinite_alternate]"
        style={{ animationDelay: '-10s' }}
      />
      
      {/* CSS for the drift animation - using inline style for isolation since we need keyframes */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes drift {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
      `}} />
    </div>
  );
}
