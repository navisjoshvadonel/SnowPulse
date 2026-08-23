import React, { useSyncExternalStore } from "react";
import { BarChart3, LineChart, TrendingUp, Layers, Activity } from "lucide-react";

const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export interface UISchema {
  type: "bar" | "line" | "scatter" | "metric";
  title: string;
  labels: string[];
  data: number[];
  color?: string;
  insight?: string;
}

export default function GenerativeChart({ schema }: { schema: UISchema }) {
  const mounted = useIsMounted();

  if (!mounted) return null;

  const maxVal = Math.max(...schema.data, 1);
  const minVal = Math.min(...schema.data, 0);
  const range = maxVal - minVal || 1;

  return (
    <div className="mt-3.5 datagem-card p-4 overflow-hidden shadow-2xl relative group">
      {/* Datagem Glowing Background Mesh */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/10 rounded-full filter blur-3xl pointer-events-none animate-datagem-glow" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/10 rounded-full filter blur-2xl pointer-events-none" />

      {/* Datagem Card Header with Floating 3D Graphic Icon */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {schema.type === 'bar' ? (
            <div className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
              <LineChart className="w-3.5 h-3.5" />
            </div>
          )}
          <h4 className="text-xs font-semibold text-white tracking-wide font-sans">{schema.title}</h4>
        </div>

        {/* Datagem Floating Isometric Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-300 text-[9px] font-mono animate-datagem-float">
          <Layers className="w-3 h-3 text-purple-400" />
          <span>Datagem UI</span>
        </div>
      </div>

      <div className="h-[140px] flex items-end gap-2 mt-4 relative">
        {schema.type === "bar" && schema.data.map((val, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group/bar relative">
            <div 
              className="w-full bg-gradient-to-t from-indigo-600/90 via-purple-500/90 to-purple-400 rounded-t-md transition-all duration-700 ease-out group-hover/bar:brightness-125 shadow-lg shadow-purple-500/20 relative"
              style={{ 
                height: `${Math.max(12, ((val - minVal) / range) * 100)}%`,
                animation: `fadeUp 0.5s ease-out ${idx * 0.08}s both`
              }}
            >
              {/* Shimmer top accent */}
              <div className="w-full h-1 bg-white/40 rounded-t-md" />
              
              <div className="opacity-0 group-hover/bar:opacity-100 absolute -top-9 left-1/2 -translate-x-1/2 bg-black/90 border border-purple-500/30 text-white text-[10px] py-1 px-2 rounded-md pointer-events-none whitespace-nowrap transition-all duration-200 z-10 font-mono shadow-xl">
                {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(val)}
              </div>
            </div>
            <span className="text-[9px] text-purple-200/60 mt-2 font-mono truncate w-full text-center max-w-full">
              {schema.labels[idx]}
            </span>
          </div>
        ))}

        {schema.type === "line" && (
           <div className="w-full h-full relative">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="datagemGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="50%" stopColor="#c4b5fd" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
                <path 
                  d={`M ${schema.data.map((val, idx) => `${(idx / (schema.data.length - 1)) * 100},${100 - (((val - minVal) / range) * 100)}`).join(' L ')}`}
                  fill="none" 
                  stroke="url(#datagemGradient)" 
                  strokeWidth="2.5"
                  className="animate-draw"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 6px 12px rgba(196, 181, 253, 0.4))' }}
                />
                {schema.data.map((val, idx) => (
                   <circle
                     key={idx}
                     cx={(idx / (schema.data.length - 1)) * 100}
                     cy={100 - (((val - minVal) / range) * 100)}
                     r="2.5"
                     className="fill-white stroke-purple-400 stroke-2"
                     style={{ animation: `fadeUp 0.3s ease-out ${idx * 0.1}s both` }}
                   />
                ))}
              </svg>
              <div className="flex justify-between mt-2 text-[9px] text-purple-200/60 font-mono absolute -bottom-6 w-full">
                {schema.labels.map((lbl, idx) => (
                   <span key={idx}>{lbl}</span>
                ))}
              </div>
           </div>
        )}

        {schema.type === "metric" && (
           <div className="w-full h-full flex items-center justify-around gap-2 px-2">
             {schema.labels.map((lbl, idx) => (
               <div key={idx} className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-center animate-datagem-float" style={{ animationDelay: `${idx * 0.3}s` }}>
                 <span className="text-[10px] text-purple-300/70 font-mono block uppercase tracking-wider">{lbl}</span>
                 <span className="text-base font-extrabold text-white font-mono mt-1 block">
                   {typeof schema.data[idx] === 'number' ? schema.data[idx].toLocaleString() : schema.data[idx]}
                 </span>
               </div>
             ))}
           </div>
        )}
      </div>

      {schema.insight && (
        <div className="mt-8 pt-3 border-t border-white/10 flex items-start gap-2">
           <Activity className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
           <p className="text-[10px] text-gray-300 leading-relaxed font-sans">{schema.insight}</p>
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes draw {
          from { stroke-dasharray: 1000; stroke-dashoffset: 1000; }
          to { stroke-dashoffset: 0; }
        }
        .animate-draw {
          animation: draw 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
}
