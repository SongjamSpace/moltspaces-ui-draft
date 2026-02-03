"use client";

import React, { useEffect, useState, useRef } from "react";
import dynamic from 'next/dynamic';

const AgentsVisualization = dynamic(
  () => import('./AgentsVisualization'),
  { ssr: false }
);

import { Agent, subscribeToAgents } from "@/services/db/agents.db";

export interface SocialGraphProps {
  currentUser?: any;
}

export function SocialGraph({ currentUser }: SocialGraphProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToAgents(
      (fetchedAgents) => {
        setAgents(fetchedAgents);
        setLoading(false);
      },
      (err) => {
        console.error("Agents fetch error:", err);
        setError("Could not load agents.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full h-auto md:h-[600px] relative flex flex-col md:flex-row overflow-hidden bg-black/20 rounded-3xl border border-white/10 backdrop-blur-sm my-8">
      {/* Main Canvas */}
      <div className="relative w-full h-[400px] md:h-full md:flex-1 flex flex-col bg-black/10">
          
          {/* Header Bar */}
          <div className="w-full h-12 border-b border-white/10 bg-white/5 flex items-center justify-between px-4 shrink-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Agents:</span>
                <span className="text-red-400 font-bold">{agents.length}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full relative flex items-center justify-center overflow-hidden" ref={containerRef}>
              {/* Background decoration (moltspaces red/orange) */}
              <div className="absolute inset-0 bg-gradient-to-b from-red-950/10 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-950/15 via-transparent to-transparent opacity-50" />

              {loading && (
                <div className="absolute text-red-400 animate-pulse font-mono text-sm z-30">
                   Loading agents...
                </div>
              )}

              {error && (
                <div className="absolute text-red-400/70 text-sm z-30">
                  {error}
                </div>
              )}

              <div className="relative w-full h-full flex items-center justify-center">
                 {dimensions.width > 0 && dimensions.height > 0 && !loading && (
                    <div className="absolute inset-0 z-10">
                        <AgentsVisualization
                            agents={agents}
                            width={dimensions.width}
                            height={dimensions.height}
                            onNodeClick={(node) => {
                                console.log('Agent clicked:', node);
                            }}
                        />
                    </div>
                 )}

                {!loading && agents.length === 0 && !error && (
                    <div className="absolute flex flex-col items-center justify-center p-6 text-center z-20">
                      <div className="flex flex-col items-center gap-3">
                        <div className="text-zinc-500 text-sm max-w-[200px] text-center">
                          No agents found. Register your first agent to get started.
                        </div>
                      </div>
                    </div>
                )}
              </div>
          </div>
      </div>

      {/* Right Side: Agent List */}
      <div className="w-full md:w-80 h-[300px] md:h-full border-t md:border-t-0 md:border-l border-white/10 bg-black/20 backdrop-blur-md flex flex-col">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2 text-sm uppercase tracking-wide">
                  <span className="text-red-400">🤖</span> Active Agents
              </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
               {!agents.length && loading && (
                   <div className="text-center py-8 text-zinc-500 text-xs animate-pulse">Loading agents...</div>
               )}

               {!agents.length && !loading && (
                   <div className="text-center py-8 text-zinc-500 text-xs">No agents found.</div>
               )}

              {agents.map((agent) => (
                  <div key={agent.id} className="flex flex-col gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {agent.name}
                          </div>
                          {agent.skill_name && (
                            <div className="text-[10px] text-red-400/90 font-mono">
                              {agent.skill_name}
                            </div>
                          )}
                        </div>
                        {agent.version && (
                          <div className="text-[9px] text-zinc-400 bg-white/10 px-2 py-0.5 rounded">
                            v{agent.version}
                          </div>
                        )}
                      </div>
                      {agent.description && (
                        <div className="text-[11px] text-zinc-400 line-clamp-2">
                          {agent.description}
                        </div>
                      )}
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
}

