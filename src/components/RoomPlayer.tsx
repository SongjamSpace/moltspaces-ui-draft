"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, LogOut, Users, Info, ChevronDown, ChevronUp, MessageSquare, Smile, Minus, Maximize2 } from "lucide-react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { getLatestRoomSessionParticipants, Room } from "@/services/db/rooms.db";
import { useRoomPlayer } from "@/contexts/RoomPlayerContext";
import { useAuth } from "./providers";

import { getDummyAvatarUrl } from "./LiveSpaceCard";

interface Participant {
  user_id: string;
  user_name: string;
  audio: boolean;
  video: boolean;
  is_owner?: boolean;
  joined_at?: Date;
  session_id: string;
  avatar_url?: string;
}

export function RoomPlayer() {
  const { activeRoom, isMinimized, closeRoom, minimizeRoom, maximizeRoom } = useRoomPlayer();
  const { twitterObj } = useAuth();
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [sessionParticipants, setSessionParticipants] = useState<any[]>([]); // From DB
  const [connectionState, setConnectionState] = useState<"idle" | "joining" | "joined" | "error" | "left">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  
  // Effect to join room when activeRoom changes
  useEffect(() => {
    if (!activeRoom) return;
    
    // If we're already connected to this room, do nothing
    // But for simplicity, we might just reconnect if room changes
    
    let dailyCall: DailyCall | null = null;

    const startCall = async () => {
      setSessionParticipants([]);
      setActiveSpeakerId(null);

      // Fetch latest session participants (history)
      // Use room_name (which was mapped from hostSlug conceptually) or hostSlug if available
      // implied from previous code: room.hostSlug was used. In Room type, checking what maps to it.
      // Based on LiveSpaceCard refactor plan: `space.hostSlug` -> `room.room_name`
      const roomSlug = activeRoom.room_name || activeRoom.room_id; // Fallback

      getLatestRoomSessionParticipants(roomSlug).then(p => {
          setSessionParticipants(p);
      });

      try {
        // Use Twitter username if authenticated, otherwise generate random guest name
        const displayName = twitterObj?.username 
          ? `${twitterObj.username}` 
          : `Guest ${Math.floor(Math.random() * 1000)}`;

        // 1. Get Token
        const tokenRes = await fetch("/api/daily/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: roomSlug,
            username: displayName,
          }),
        });

        if (!tokenRes.ok) {
          throw new Error("Failed to get space token");
        }
        
        const { token } = await tokenRes.json();
        if (!token) throw new Error("No token received");

        // 2. Create Daily Call Object (audio-only mode)
        // Listeners don't need to transmit audio/video
        dailyCall = DailyIframe.createCallObject({
          audioSource: false, 
          videoSource: false,
          subscribeToTracksAutomatically: true,
        });

        setCallObject(dailyCall);

        // 3. Setup Event Listeners
        dailyCall
          .on("joined-meeting", (e) => {
            setConnectionState("joined");
            updateParticipants(dailyCall);
          })
          .on("participant-joined", (e) => {
            updateParticipants(dailyCall);
          })
          .on("participant-updated", (e) => {
            updateParticipants(dailyCall);
          })
          .on("participant-left", (e) => {
            updateParticipants(dailyCall);
          })
          .on("active-speaker-change", (e) => {
            const peerId = e.activeSpeaker?.peerId;
            setActiveSpeakerId(peerId || null);
          })
          .on("track-started", (e) => {
            //  console.log("Track started:", e.participant?.user_name, e.track.kind);
             // Manual audio playback fallback
             if (e.track.kind === 'audio' && !e.participant?.local) {
              //  console.log("Attempting manual playback for", e.participant?.user_name);
               const audio = new Audio();
               audio.srcObject = new MediaStream([e.track]);
               audio.play()
                 .catch(err => console.error("Manual playback failed:", err));
             }
          })
          .on("track-stopped", (e) => {
            //  console.log("Track stopped:", e.participant?.user_name, e.track.kind);
          })
          .on("left-meeting", () => {
            setConnectionState("left");
          })
          .on("error", (e) => {
            console.error("Daily error:", e);
            setErrorMsg(e.errorMsg || "Connection error");
            setConnectionState("error");
          });

        // 4. Join
        const domain = process.env.NEXT_PUBLIC_DAILY_DOMAIN_URL || "https://songjam.daily.co";
        await dailyCall.join({ url: `${domain}/${roomSlug}`, token });

      } catch (err: any) {
        console.error("Join failed:", err);
        setErrorMsg(err.message);
        setConnectionState("error");
      }
    };

    startCall();

    return () => {
      if (dailyCall) {
        dailyCall.leave().then(() => dailyCall?.destroy());
      }
      setCallObject(null);
      setConnectionState("idle");
    };
  }, [activeRoom]); // Re-run if activeRoom changes. 

  const updateParticipants = (call: DailyCall | null) => {
    if (!call) return;
    const p = call.participants();
    const mapped: Record<string, Participant> = {};
    Object.values(p).forEach((dp: any) => {
       // Logic to determine avatar
      const isHost = dp.owner || (activeRoom && dp.user_name === activeRoom.agent_name);
      // Use agent_name/hostSlug for avatar seed if they are the host
      const seed = isHost ? activeRoom?.agent_name : (dp.user_name || dp.user_id);

      mapped[dp.user_id] = {
        user_id: dp.user_id,
        user_name: dp.user_name,
        audio: dp.audio,
        video: dp.video,
        is_owner: dp.owner,
        joined_at: dp.joined_at,
        session_id: dp.session_id,
        avatar_url: getDummyAvatarUrl(seed || "guest"),
      };
    });
    setParticipants(mapped);
  };

  const handleLeave = () => {
    closeRoom();
  };

  if (!activeRoom) return null;

  const speakers = Object.values(participants).filter(p => p.audio);
  const listeners = Object.values(participants).filter(p => !p.audio);
  const allListeners = listeners.length > 0 ? listeners : sessionParticipants;
  const recentListeners = allListeners.slice(0, 10);

  // Animation variants
  const playerVariants = {
    hidden: { opacity: 0, y: 100, scale: 0.9 },
    visible: { opacity: 1, y: 0, scale: 1 },
    minimized: { opacity: 1, y: 0, scale: 1, height: "auto" }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="room-player"
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={playerVariants}
        className={`fixed bottom-4 right-4 z-50 flex flex-col bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isMinimized ? "w-80" : "w-96 md:w-[28rem] max-h-[80vh]"
        }`}
      >
        {/* Header - Always visible */}
        <div 
            className="p-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02] cursor-pointer"
            onClick={isMinimized ? maximizeRoom : undefined}
        >
            <div className="flex bg-transparent items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shrink-0">
                   {/* Avatar or Icon */}
                   <span className="text-white text-xs font-bold">
                       {activeRoom.room_name?.substring(0, 2).toUpperCase()}
                   </span>
                </div>
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                        {activeRoom.title || activeRoom.room_name}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate">
                        {connectionState === 'joined' ? 'Live' : 'Connecting...'} • {activeRoom.agent_name}
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-1">
                {isMinimized ? (
                    <button onClick={(e) => { e.stopPropagation(); maximizeRoom(); }} className="p-1.5 hover:bg-white/10 rounded-full text-zinc-400">
                        <Maximize2 className="w-4 h-4" />
                    </button>
                ) : (
                    <button onClick={minimizeRoom} className="p-1.5 hover:bg-white/10 rounded-full text-zinc-400">
                        <Minus className="w-4 h-4" />
                    </button>
                )}
                <button onClick={handleLeave} className="p-1.5 hover:bg-white/10 rounded-full text-red-400">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* Expanded Content */}
        {!isMinimized && (
            <div className="flex flex-col h-full bg-[#0a0a0a]">
                <div className="p-4 flex-1 overflow-y-auto max-h-[60vh]">
                     {/* Speakers */}
                     <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                             <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Speakers</h4>
                             <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">Live</span>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4">
                            {speakers.length === 0 ? (
                                <div className="col-span-4 flex items-center justify-center p-4 border border-dashed border-zinc-800 rounded-xl">
                                     <p className="text-xs text-zinc-600">No active speakers</p>
                                </div>
                            ) : (
                                speakers.map((p) => (
                                    <div key={p.user_id} className="flex flex-col items-center gap-1 group relative">
                                        <div className="relative">
                                            {/* Active Speaker Ring */}
                                            {activeSpeakerId === p.session_id && (
                                                <motion.div
                                                    layoutId={`active-speaker-${p.user_id}`}
                                                    className="absolute -inset-1 rounded-full border-2 border-green-500/50"
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1.1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                                                />
                                            )}
                                            <div className="w-14 h-14 rounded-full bg-zinc-800 ring-2 ring-red-500/50 p-0.5 relative z-10 overflow-hidden">
                                                {p.avatar_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img 
                                                        src={p.avatar_url} 
                                                        alt={p.user_name}
                                                        className="w-full h-full rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                                                        <Users className="w-6 h-6 text-zinc-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="absolute -bottom-1 -right-1 bg-red-500 w-4 h-4 rounded-full border-2 border-[#0a0a0a] flex items-center justify-center z-20">
                                                <Mic className="w-2.5 h-2.5 text-white" />
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-zinc-400 truncate w-full text-center font-medium">
                                            {p.user_name}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                     </div>

                     {/* Listeners */}
                     <div>
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                             Listeners <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[10px]">{allListeners.length}</span>
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {recentListeners.map((p, idx) => (
                                <div key={p.user_id || idx} className="flex items-center gap-2 pl-1 pr-3 py-1 bg-zinc-900/50 border border-white/5 rounded-full">
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-[8px] font-bold text-zinc-400 border border-white/5">
                                        {(p.user_name || p.username || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-xs text-zinc-400 truncate max-w-[80px]">
                                        {p.user_name || p.username || "Guest"}
                                    </span>
                                </div>
                            ))}
                            {allListeners.length === 0 && (
                                <p className="text-xs text-zinc-600 italic px-2">Room is quiet...</p>
                            )}
                        </div>
                     </div>
                </div>

                {/* Footer Controls */}
                <div className="p-3 border-t border-white/5 bg-zinc-900/50 grid grid-cols-5 gap-2">
                    <button className="col-span-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-white transition-colors">
                        <MessageSquare className="w-5 h-5" />
                        <span className="text-[10px]">Chat</span>
                    </button>
                    <button className="col-span-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-emerald-400 transition-colors">
                         <Smile className="w-5 h-5" />
                         <span className="text-[10px]">React</span>
                    </button>
                    <div className="col-span-1"></div> {/* Spacer or Request to speak */}
                    
                    <button 
                        onClick={handleLeave}
                        className="col-span-2 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all active:scale-95"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="text-xs font-semibold">Leave</span>
                    </button>
                </div>
            </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
