import React, { useEffect, useState } from "react";
import { BarChart3, LineChart, TrendingUp } from "lucide-react";

export interface UISchema {
  type: "bar" | "line" | "scatter" | "metric";
  title: string;
  labels: string[];
  data: number[];
  color?: string;
  insight?: string;
}

export default function GenerativeChart({ schema }: { schema: UISchema }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const maxVal = Math.max(...schema.data, 1);
  const minVal = Math.min(...schema.data, 0);
  const range = maxVal - minVal;

  return (
    <div className="mt-3 bg-black/40 border border-white/10 rounded-xl p-4 overflow-hidden shadow-2xl relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full filter blur-3xl pointer-events-none" />
      
      <div className="flex items-center gap-2 mb-4">
        {schema.type === 'bar' ? <BarChart3 className="w-4 h-4 text-brand-primary" /> : <LineChart className="w-4 h-4 text-indigo-400" />}
        <h4 className="text-xs font-semibold text-white tracking-wide">{schema.title}</h4>
      </div>

      <div className="h-[140px] flex items-end gap-2 mt-4 relative">
        {schema.type === "bar" && schema.data.map((val, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
            <div 
              className="w-full bg-brand-primary/80 rounded-t-sm transition-all duration-1000 ease-out hover:bg-brand-primary"
              style={{ 
                height: `${Math.max(10, ((val - minVal) / range) * 100)}%`,
                animation: `fadeUp 0.5s ease-out ${idx * 0.1}s both`
              }}
            >
              <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 border border-white/10 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap transition-opacity z-10 font-mono">
                {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(val)}
              </div>
            </div>
            <span className="text-[9px] text-brand-muted mt-2 font-mono truncate w-full text-center max-w-full">
              {schema.labels[idx]}
            </span>
          </div>
        ))}

        {schema.type === "line" && (
           <div className="w-full h-full relative">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <path 
                  d={`M ${schema.data.map((val, idx) => `${(idx / (schema.data.length - 1)) * 100},${100 - (((val - minVal) / range) * 100)}`).join(' L ')}`}
                  fill="none" 
                  stroke="var(--color-brand-primary, #6366f1)" 
                  strokeWidth="2"
                  className="animate-draw"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 4px 6px rgba(99, 102, 241, 0.4))' }}
                />
                {schema.data.map((val, idx) => (
                   <circle
                     key={idx}
                     cx={(idx / (schema.data.length - 1)) * 100}
                     cy={100 - (((val - minVal) / range) * 100)}
                     r="2"
                     className="fill-white stroke-brand-primary stroke-2"
                     style={{ animation: `fadeUp 0.3s ease-out ${idx * 0.1}s both` }}
                   />
                ))}
              </svg>
              <div className="flex justify-between mt-2 text-[9px] text-brand-muted font-mono absolute -bottom-6 w-full">
                {schema.labels.map((lbl, idx) => (
                   <span key={idx}>{lbl}</span>
                ))}
              </div>
           </div>
        )}
      </div>

      {schema.insight && (
        <div className="mt-8 pt-3 border-t border-white/10 flex items-start gap-2">
           <TrendingUp className="w-3.5 h-3.5 text-brand-success mt-0.5 flex-shrink-0" />
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
