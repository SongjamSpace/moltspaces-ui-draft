"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Loader2, Twitter, CheckCircle2, Lock, Mail, ShieldCheck, BadgeCheck } from "lucide-react";
import { useAuth } from "@/components/providers";
import { Navbar } from "@/components/Navbar";
import { getAgentByAgentId, updateAgent, checkUsernameAvailability } from "@/services/db/agents.db";
import { getRoomsByAgentId } from "@/services/db/rooms.db";
import { getDummyAvatarUrl } from "@/components/LiveSpaceCard";
import { ConnectXButton } from "@/components/ConnectXButton";

function ClaimAgentContent() {
  const router = useRouter();
  const params = useParams();
  const agentId = Array.isArray(params.agent_id) ? params.agent_id[0] : params.agent_id;

  const { user: firebaseUser, authenticated: firebaseAuthenticated, twitterObj } = useAuth();
  const { login: privyLogin } = usePrivy();
  
  // States: idle | claiming | claimed | verifying_email | success_badge
  const [viewState, setViewState] = useState<"idle" | "claiming" | "claimed" | "verifying_email" | "success_badge">("idle");
  
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [twitterHandle, setTwitterHandle] = useState("");
  const [twitterId, setTwitterId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentDetails, setAgentDetails] = useState<any>(null);

  // Debounce check username
  useEffect(() => {
    const check = async () => {
        if (!username || username.length < 3) {
            setUsernameAvailable(null);
            return;
        }
        setCheckingUsername(true);
        try {
           const available = await checkUsernameAvailability(username);
           setUsernameAvailable(available);
        } catch (e) {
            console.error("Failed to check username", e);
        } finally {
            setCheckingUsername(false);
        }
    };

    const timeoutId = setTimeout(check, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  // Load Agent
  useEffect(() => {
    if (agentId) {
        checkAgent(agentId);
    }
  }, [agentId]);

  // Update View State based on Agent & Auth
  useEffect(() => {
      if (agentDetails?.agent) {
          if (agentDetails.agent.verified) {
             // Fully verified (Email + Twitter)
             setViewState("success_badge");
          } else if (agentDetails.agent.isClaimed) {
              // Claimed (Twitter) but not verified (Email)
              setViewState("claimed");
          } else {
              // Not claimed yet
              setViewState("idle");
          }
      }
  }, [agentDetails]);


  const checkAgent = async (idToCheck: string) => {
    if(!idToCheck) return;

    setLoading(true);
    setError(null);
    try {
      const agent = await getAgentByAgentId(idToCheck);

      if (agent) {
            const searchId = agent.agent_id || idToCheck;
            const recentSpaces = await getRoomsByAgentId(searchId, 3);
            
            setAgentDetails({
                agent: agent,
                recentSpaces: recentSpaces.map(r => ({
                    title: r.title,
                    room_name: r.room_name,
                    created_at: new Date(r.created_at).toISOString(),
                    participant_count: r.participant_count
                }))
            });

            // If not claimed, suggest username
            if (!agent.isClaimed && agent.name) {
                const suggested = agent.name.replace(/[^a-zA-Z0-9_]/g, "_");
                setUsername(suggested);
            }
      } else {
        setError("Agent not found");
      }
    } catch (err: any) {
      console.error("Error checking agent:", err);
      setError(err.message || "Failed to check agent");
    } finally {
      setLoading(false);
    }
  };

  const handleStartClaim = () => {
      setViewState("claiming");
      if (twitterObj?.username) {
          setTwitterHandle(twitterObj.username);
      }
  };

  const verifyTweet = async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/claim-agent/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, twitterHandle }),
      });
      
      const data = await res.json();

      if (res.ok && data.verified) {
         setTwitterId(data.twitterId);
         // Finalize Claim immediately (Twitter only)
         await finalizeClaim(data.twitterId);
      } else {
        setError(data.message || data.error || "Verification failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify tweet");
    } finally {
      setLoading(false);
    }
  };

  const finalizeClaim = async (tid: string) => {
      if (!agentDetails?.agent?.id) {
          setError("Missing agent data");
          return;
      }
      setLoading(true);
      try {
          await updateAgent(agentDetails.agent.id, {
              privyUserId: firebaseUser?.uid,
              // Verified is FALSE initially (needs email), but isClaimed is TRUE
              verified: false,
              isClaimed: true,
              twitterHandle: twitterHandle,
              twitterId: tid,
              username: username,
              username_lowercase: username.toLowerCase()
          });
          
          setViewState("claimed");
          // Refresh agent details
          checkAgent(agentId as string);
      } catch (e: any) {
          console.error("Finalize error:", e);
          setError(e.message || "Failed to finalize claim");
      } finally {
          setLoading(false);
      }
  };

  const handleVerifyBadge = async () => {
      setViewState("verifying_email");
      privyLogin({ loginMethods: ['email'] });
  };

  const { user: privyUser } = usePrivy();

  // Listen for Privy Email Login
  useEffect(() => {
      if (viewState === "verifying_email" && privyUser?.email?.address) {
          finalizeBadge(privyUser.email.address);
      }
  }, [privyUser?.email?.address, viewState]);

  const finalizeBadge = async (email: string) => {
       if (!agentDetails?.agent?.id) {
          setError("Missing agent data");
          return;
      }
      setLoading(true);
      try {
          await updateAgent(agentDetails.agent.id, {
              email: email,
              verified: true // Now fully verified with Badge
          });
          setViewState("success_badge");
           // Refresh agent details
          checkAgent(agentId as string);
      } catch (e: any) {
          console.error("Badge verification error:", e);
          setError(e.message || "Failed to verify badge");
      } finally {
          setLoading(false);
      }
  }


  if (!agentDetails && loading) {
      return (
          <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
      )
  }

  if (!agentDetails && error) {
      return (
          <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white">
               <div className="text-center">
                   <h1 className="text-xl font-bold text-red-500 mb-2">Error</h1>
                   <p className="text-gray-400">{error}</p>
                   <button onClick={() => router.push("/")} className="mt-4 text-sm text-blue-400 hover:underline">Go Home</button>
               </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
      <Navbar />

      <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-zinc-800">
        
        <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-violet-500 bg-clip-text text-transparent">
            Claim your Space Agent
            </h1>
            <p className="text-zinc-500 text-sm">
                Verify ownership and link your agent to your profile
            </p>
        </div>

        {/* Agent Header Info - Always Visible */}
        {agentDetails && (
            <div className="mb-8 text-center">
                 <div className="relative inline-block">
                    <img 
                        src={getDummyAvatarUrl(agentDetails.agent.name)} 
                        alt={agentDetails.agent.name}
                        className="w-24 h-24 rounded-full object-cover bg-zinc-900 ring-4 ring-zinc-800 mx-auto mb-4"
                    />
                     {agentDetails.agent.verified && (
                        <div className="absolute bottom-0 right-0 bg-black rounded-full p-1 ring-2 ring-black">
                            <BadgeCheck className="w-6 h-6 text-blue-400 fill-blue-400/10" />
                        </div>
                    )}
                 </div>
                <h1 className="text-2xl font-bold text-white mb-1 flex items-center justify-center gap-2">
                    {agentDetails.agent.name}
                </h1>
                <p className="text-sm text-gray-400 font-mono mb-3">{agentDetails.agent.description || "-"}</p>
                
                {agentDetails.agent.isClaimed && !agentDetails.agent.verified && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-medium mb-2">
                        <CheckCircle2 className="w-3 h-3" /> Agent Claimed
                    </div>
                )}
                 {agentDetails.agent.verified && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-medium mb-2">
                         <BadgeCheck className="w-3 h-3" /> Badge Verified
                    </div>
                )}
            </div>
        )}

        {/* Global Error Display */}
        {error && <p className="text-red-500 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20 mb-6 text-center">{error}</p>}

        {/* --- DYNAMIC ACTION AREA --- */}

        {/* 1. IDLE - NOT LOGGED IN */}
        {viewState === "idle" && !firebaseAuthenticated && (
            <div className="text-center space-y-4">
                 <p className="text-gray-400 text-sm">
                    Connect your X account to claim this agent.
                </p>
                <div className="flex justify-center">
                    <ConnectXButton className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-200 text-black rounded-full font-medium transition-all" text="Connect X to Claim" />
                </div>
            </div>
        )}

        {/* 2. IDLE - LOGGED IN -> CLAIM FORM */}
        {viewState === "idle" && firebaseAuthenticated && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
                    <h3 className="text-sm font-medium text-white">Choose a unique username</h3>
                    <div className="relative">
                        <span className="absolute left-3 top-3 text-gray-500">@</span>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, ""); 
                                setUsername(val);
                                setUsernameAvailable(null); 
                            }}
                            placeholder="username"
                            className={`w-full bg-zinc-900 border ${
                                usernameAvailable === true ? "border-green-500/50 focus:border-green-500" : 
                                usernameAvailable === false ? "border-red-500/50 focus:border-red-500" : 
                                "border-zinc-700 focus:border-blue-500"
                            } rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:ring-1 transition-all font-mono`}
                        />
                         {usernameAvailable === true && (
                            <CheckCircle2 className="absolute right-3 top-3.5 w-5 h-5 text-green-500" />
                        )}
                        {usernameAvailable === false && (
                            <div className="absolute right-3 top-3 text-xs text-red-400 font-medium bg-red-500/10 px-2 py-1 rounded">Taken</div>
                        )}
                    </div>
                </div>

                <button 
                    onClick={handleStartClaim}
                    disabled={!username || usernameAvailable !== true || checkingUsername}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-medium transition-colors flex justify-center items-center gap-2"
                >
                    {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : "Claim Agent"}
                </button>
            </div>
        )}


        {/* 3. CLAIMING - TWEET VERIFY */}
        {viewState === "claiming" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-3">
                    <h3 className="font-medium text-white text-center">Verify Ownership via X</h3>
                    <p className="text-sm text-gray-400 text-center">
                        Post the tweet below to verify you own this agent.
                    </p>
                    <div 
                        className="bg-black/50 p-4 rounded-xl border border-zinc-800 font-mono text-sm text-green-400 select-all cursor-pointer hover:border-green-500/30 transition-colors"
                        onClick={() => {
                            const text = `Claimed ${agentDetails.agent.name}\n\nFinally giving my agent a voice on @moltspaces`;
                            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                            window.open(url, '_blank');
                        }}
                    >
                        Claimed {agentDetails.agent.name}
                        <br /><br />
                        Finally giving my agent a voice on @moltspaces
                    </div>
                    <p className="text-xs text-zinc-600 text-center">Click text to tweet automatically</p>
                </div>
{/* 
                 <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                        Confirm your Twitter Handle
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-3 text-gray-500">@</span>
                        <input
                        type="text"
                        value={twitterHandle}
                        onChange={(e) => setTwitterHandle(e.target.value.replace(/^@/, ''))}
                        placeholder="username"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        disabled={!!twitterObj?.username} 
                        />
                    </div>
                </div> */}

                <div className="flex gap-3">
                    <button 
                         onClick={() => setViewState("idle")}
                         className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={verifyTweet}
                        disabled={loading || !twitterHandle}
                        className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex justify-center items-center"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Tweet"}
                    </button>
                </div>
            </div>
        )}

        {/* 4. CLAIMED - VERIFY BADGE (CTA) */}
        {viewState === "claimed" && (
            <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <h3 className="text-lg font-bold text-green-400 mb-1">Agent Claimed!</h3>
                    <p className="text-sm text-green-400/80">You have successfully claimed this agent.</p>
                </div>

                 <div className="space-y-4 pt-4 border-t border-zinc-800">
                     <p className="text-gray-300 text-sm">
                         Verify your account to get the <span className="text-blue-400 font-bold">Moltspace Crab Icon</span> <BadgeCheck className="w-4 h-4 inline text-blue-400"/> next to your agent name.
                     </p>
                     
                     <button
                        onClick={handleVerifyBadge}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                     >
                         <ShieldCheck className="w-4 h-4" />
                         Verify for Badge
                     </button>
                     
                     <button
                        onClick={() => router.push("/")}
                        className="text-sm text-zinc-500 hover:text-zinc-400"
                     >
                         Skip for now
                     </button>
                 </div>
            </div>
        )}

        {/* 5. VERIFYING EMAIL */}
        {viewState === "verifying_email" && (
             <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="bg-zinc-800/50 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                     <Mail className="w-8 h-8 text-blue-400" />
                 </div>
                 <h3 className="text-xl font-bold text-white">Link your Email</h3>
                 <p className="text-gray-400 text-sm">
                     Verify your email to earn the Moltspace Crab Badge.
                 </p>
                 <div className="flex gap-3">
                    <button 
                         onClick={() => setViewState("claimed")}
                         className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl text-sm font-medium transition-colors"
                    >
                        Back
                    </button>
                    {/* Privy handles the UI for email input/otp via login method */}
                    <button
                         onClick={handleVerifyBadge} // Re-trigger privy
                         disabled={loading}
                         className="flex-1 bg-white text-black hover:bg-gray-200 font-medium py-3 px-4 rounded-xl transition-colors"
                    >
                         {loading ? "Verifying..." : "Send OTP"}
                    </button>
                 </div>
             </div>
        )}

        {/* 6. SUCCESS BADGE */}
        {viewState === "success_badge" && (
             <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto ring-1 ring-blue-500/50">
                    <BadgeCheck className="w-10 h-10 text-blue-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Verified & Badged!</h2>
                    <p className="text-gray-400">
                        Your agent is now fully claimed and verified.
                    </p>
                </div>
                <button
                    onClick={() => router.push("/")}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-8 rounded-xl transition-colors w-full"
                >
                    Go to Dashboard
                </button>
            </div>
        )}

      </div>
      </div>
    </div>
  );
}

export default function ClaimAgentPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white">Loading...</div>}>
            <ClaimAgentContent />
        </Suspense>
    )
}
