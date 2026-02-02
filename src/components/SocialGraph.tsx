"use client";

import React, { useEffect, useState, useRef } from "react";
import { Lock } from "lucide-react";

import { db } from "@/services/firebase.service";
import { useNeynarContext } from "@neynar/react";
import { neynarClient } from "@/services/neynar-client";
import axios from "axios";
import dynamic from 'next/dynamic';

const SocialGraphVisualization = dynamic(
  () => import('./SocialGraphVisualization'),
  { ssr: false }
);

import { 
  ProcessFarcasterProfile, 
  ProcessMetadata, 
  subscribeToProcessMetadata, 
  subscribeToProcessProfiles, 
  updateProfileFollow
} from "@/services/db/processFarcaster.service";
import { INeynarAuthenticatedUser } from "@neynar/react/dist/types/common";



export interface SocialGraphProps {
  currentUser: INeynarAuthenticatedUser & {
    verified_accounts?: Array<{
      platform: 'x' | 'instagram' | 'tiktok' | string;
      username: string;
    }>;
  } | null;
  twitterUsername?: string;
}

export function SocialGraph({ currentUser }: SocialGraphProps) {
  const currentUserTwitterUsername = React.useMemo(() => 
    currentUser?.verified_accounts?.find(acc => acc.platform === 'x')?.username, 
    [currentUser]
  );
  const [data, setData] = useState<ProcessFarcasterProfile[]>([]);
  const [metadata, setMetadata] = useState<ProcessMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const canFollow = true;
  
  // Ref for container constraints if needed
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

  const graphData = React.useMemo(() => {
    if (!currentUser) return { nodes: [], links: [] };

    // Central node
    const centralNode = {
      id: "root",
      farcasterUsername: currentUser?.username,
      // Priority: 1. Metadata from generation (most recent/accurate) 2. Unavatar fallback 3. Current user PFP
      pfpUrl: metadata?.pfpUrl 
        ? metadata.pfpUrl 
        : currentUser?.pfp_url,
      type: "root",
      x: 0,
      y: 0,
      fx: 0, // Fix central node to center essentially, or let it float? Let's fix it initially or let forces handle it.
             // Actually, force-graph centers automatically.
    };
    
    // If no data yet, just return empty to hide the center node as requested
    if (data.length === 0) {
        return { nodes: [], links: [] };
    }

    const nodes = [
      centralNode,
      ...data.map((user) => ({
        ...user,
        id: user.farcasterId, // Use farcasterId as ID
      })),
    ];

    const links = data.map((user) => ({
      source: "root",
      target: user.farcasterId,
    }));

    return { nodes, links };
  }, [data, currentUser]);

  useEffect(() => {
    if (!currentUserTwitterUsername) return;

    // Listen to metadata (parent document)
    // Listen to metadata (parent document)
    const unsubscribeDoc = subscribeToProcessMetadata(currentUserTwitterUsername, (data) => {
        setMetadata(data);
    });

    return () => unsubscribeDoc();
  }, [currentUserTwitterUsername]);

  useEffect(() => {
    if (!currentUserTwitterUsername) {
        // If no twitterUsername provided, we don't attach listener.
        return;
    }

    setLoading(true);
    setError(null);

    // Points to the subcollection "profiles" inside the document "twitterUsername" inside collection "process_farcaster"
    // Listen to profiles subcollection
    const unsubscribe = subscribeToProcessProfiles(
        currentUserTwitterUsername,
        (profiles, count) => {
            setLoading(false);
            setTotalCount(count);
            
            if (profiles.length > 0) {
                 setData(profiles);
            } else {
                 setData([]); 
            }
        },
        (err) => {
            console.error("Social graph listener error:", err);
            setError("Could not load social graph.");
            setLoading(false);
        }
    );

    return () => unsubscribe();
  }, [currentUserTwitterUsername]);

  // if (!currentUser) return null;

   const [isMobile, setIsMobile] = useState(false);

   useEffect(() => {
     const checkMobile = () => setIsMobile(window.innerWidth < 768);
     checkMobile();
     window.addEventListener('resize', checkMobile);
     return () => window.removeEventListener('resize', checkMobile);
   }, []);

  const handleFollow = async (fid: string, viewerContext: ProcessFarcasterProfile['viewerContext']) => {
      if (!currentUser?.signer_uuid || !currentUserTwitterUsername) {
          alert("Please sign in with Farcaster to follow users.");
          return;
      }
      
      setFollowLoading(prev => ({ ...prev, [fid]: true }));

      try {
           await neynarClient.publishFollow(currentUser.signer_uuid, parseInt(fid));
           // No need to set local state, backend update will reflect in viewerContext
           await updateProfileFollow(currentUserTwitterUsername, fid, viewerContext);
      } catch (err) {
          console.error("Follow failed", err);
          alert("Failed to follow user.");
      } finally {
          setFollowLoading(prev => ({ ...prev, [fid]: false }));
      }
  };

  const handleGenerateGraph = async (twitterUsername: string) => {
      if (!twitterUsername) return;
      if (!currentUser) {
          alert("Please sign in with Farcaster to generate your social graph.");
          return;
      }
      
      setIsGenerating(true);
      try {
          // Trigger the generation process
          await axios.post(`${process.env.NEXT_PUBLIC_SONGJAM_SERVER}/social-graph/process-farcaster`, {
              twitterUsername,
              fid: currentUser.fid,
              pfpUrl: currentUser.pfp_url || '',
              farcasterUsername: currentUser.username
          });

      } catch (err) {
          console.error("Failed to generate graph:", err);
          alert("Failed to start social graph generation. Please try again.");
      } finally {
          setIsGenerating(false);
      }
  };

  const formatDate = (timestamp?: number) => {
      if (!timestamp) return "";
      return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="w-full h-auto md:h-[600px] relative flex flex-col md:flex-row overflow-hidden bg-slate-900/20 rounded-3xl border border-slate-800/50 backdrop-blur-sm my-8">
      {/* Left Side: Graph Visualization */}
      <div className="relative w-full h-[400px] md:h-full md:flex-1 flex flex-col bg-slate-900/10">
          
          {/* Header Bar */}
          <div className="w-full h-12 border-b border-slate-800/50 bg-slate-900/40 flex items-center justify-between px-4 shrink-0 z-20 backdrop-blur-md">
             {metadata && (
                 <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="flex items-center gap-2">
                          <span className="text-slate-500">Status:</span>
                          <span className={`font-bold capitalize ${
                              metadata.status === 'completed' ? 'text-green-400' :
                              metadata.status === 'processing' ? 'text-yellow-400 animate-pulse' :
                              metadata.status === 'failed' ? 'text-red-400' : 'text-slate-300'
                          }`}>
                              {metadata.status}
                          </span>
                      </div>
                       {totalCount > 0 && (
                          <div className="flex items-center gap-2">
                              <span className="text-slate-500">Found:</span>
                              <span className="text-cyan-400 font-bold">{totalCount} profiles</span>
                          </div>
                      )}
                      {metadata.updatedAt && (
                          <div className="hidden md:block text-slate-500">
                              Updated: {formatDate(metadata.updatedAt)}
                          </div>
                      )}
                      {/* Message moved to center of graph */}
                 </div>
             )}
          </div>

          <div className="flex-1 w-full relative flex items-center justify-center overflow-hidden" ref={containerRef}>
              {/* Background decoration */}
              <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent opacity-50" />

              {/* Center Status Message */}
              {metadata && metadata.status !== 'completed' && metadata.message && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 px-6 py-4 rounded-2xl shadow-2xl flex flex-col items-center gap-3 max-w-md text-center mx-4 animate-in fade-in zoom-in duration-300">
                          {metadata.status === 'processing' && (
                              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2" />
                          )}
                          <span className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                              {metadata.message}
                          </span>
                          {metadata.status === 'processing' && (
                              <span className="text-xs text-slate-400 font-mono">
                                  Processing social graph...
                              </span>
                          )}
                      </div>
                  </div>
              )}

              {loading && !metadata && (
                <div className="absolute text-cyan-400 animate-pulse font-mono text-sm z-30">
                   Scanning social network...
                </div>
              )}

              {error && (
                <div className="absolute text-red-400/70 text-sm z-30">
                  {error}
                </div>
              )}

              <div className="relative w-full h-full flex items-center justify-center">
                 
                 {dimensions.width > 0 && dimensions.height > 0 && (
                    <div className="absolute inset-0 z-10">
                        <SocialGraphVisualization
                            data={graphData}
                            width={dimensions.width}
                            height={dimensions.height}
                            contextLabel={currentUser?.username ? `@${currentUser?.username}` : ''}
                            onNodeClick={(node) => {
                                if (node.id !== 'root') {
                                    window.open(`https://warpcast.com/${node.farcasterUsername}`, '_blank');
                                }
                            }}
                        />
                    </div>
                 )}

                {!loading && data.length === 0 && !error && (
                    <div className="absolute flex flex-col items-center justify-center p-6 text-center z-20">
                        {!currentUser ? (
                             <div className="flex flex-col items-center gap-3">
                                <div className="text-slate-500 text-sm max-w-[200px] text-center">
                                    Track the MoltNet as it grows.
                                </div>
                             </div>
                        ) : (
                            currentUser?.verified_accounts?.find(acc => acc.platform === 'x') ? (
                                <button 
                                    onClick={() => {
                                        const xAccount = currentUser.verified_accounts?.find(acc => acc.platform === 'x');
                                        if (xAccount) {
                                            handleGenerateGraph(xAccount.username);
                                        }
                                    }}
                                    disabled={isGenerating}
                                    className={`px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl font-bold text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 transition-all flex items-center gap-2 group ${isGenerating ? 'opacity-70 cursor-wait' : ''}`}
                                >
                                    {isGenerating ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <span className="text-xl">🕸️</span>
                                    )}
                                    <div>
                                        <div className="text-sm">Generate Social Graph</div>
                                        <div className="text-[10px] font-normal text-purple-200">
                                            using @{currentUser.verified_accounts.find(acc => acc.platform === 'x')?.username}
                                        </div>
                                    </div>
                                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            ) : (
                                <div className="flex flex-col items-center gap-3">
                                    <div className="text-slate-500 text-sm max-w-[200px] text-center">
                                        X should be connected with Farcaster to generate the social graph.
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}
              </div>
          </div>
      </div>

      {/* Right Side: Quick Follow List */}
      <div className="w-full md:w-80 h-[300px] md:h-full border-t md:border-t-0 md:border-l border-slate-800/50 bg-slate-950/30 backdrop-blur-md flex flex-col">
          <div className="p-4 border-b border-slate-800/50 bg-slate-900/40 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2 text-sm uppercase tracking-wide">
                  <span className="text-yellow-400">⚡</span> Quick Follow
              </h3>
              {/* {data.length > 0 && <button
                  disabled={!canFollow}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    !canFollow
                        ? 'bg-slate-800/50 text-slate-400 border-slate-700/50 cursor-not-allowed opacity-75'
                        : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
               >
                  {!canFollow && <Lock className="w-3 h-3" />}
                  <span>Follow All</span>
              </button>} */}
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
               {!data.length && loading && (
                   <div className="text-center py-8 text-slate-500 text-xs animate-pulse">Loading suggestions...</div>
               )}

               {!data.length && !loading && (
                   <div className="text-center py-8 text-slate-500 text-xs">No users found.</div>
               )}

              {data.map((user) => (
                  <div key={user.farcasterId} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700">
                              {user.pfpUrl ? (
                                  <img src={user.pfpUrl} alt={user.farcasterUsername} className="w-full h-full object-cover" />
                              ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br from-purple-600 to-blue-600">
                                      {user.farcasterUsername.slice(0, 2).toUpperCase()}
                                  </div>
                              )}
                          </div>
                          <div className="min-w-0 flex flex-col">
                              <span className="text-xs font-bold text-white truncate max-w-[100px]">
                                  {user.farcasterName || user.farcasterUsername}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate">
                                  @{user.farcasterUsername}
                              </span>
                          </div>
                      </div>
                      
                      <button
                          onClick={() => handleFollow(user.farcasterId, user.viewerContext)}
                          disabled={!canFollow || followLoading[user.farcasterId] || user.viewerContext?.following}
                          className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all min-w-[70px] flex items-center justify-center gap-1 border border-slate-700/50 ${
                              !canFollow || followLoading[user.farcasterId] || user.viewerContext?.following
                                  ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                                  : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
                          }`}
                      >
                          {followLoading[user.farcasterId] ? (
                              <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                          ) : (user.viewerContext?.following) ? (
                               <span>Following</span>
                          ) : !canFollow ? (
                              <>
                                <Lock className="w-3 h-3" />
                                <span>Follow</span>
                              </>
                          ) : (
                              <span>Follow</span>
                          )}
                      </button>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
}

