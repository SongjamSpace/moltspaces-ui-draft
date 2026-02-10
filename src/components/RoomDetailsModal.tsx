"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, LogOut, Users, Info } from "lucide-react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { getLatestRoomSessionParticipants } from "@/services/db/rooms.db";

import { getDummyAvatarUrl } from "./LiveSpaceCard"; // Ensure this is exported from LiveSpaceCard

interface RoomDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: {
    hostSlug: string;
    title?: string;
    hostFid?: string;
  } | null;
}

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

export function RoomDetailsModal({ isOpen, onClose, room }: RoomDetailsModalProps) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [sessionParticipants, setSessionParticipants] = useState<any[]>([]); // From DB
  const [connectionState, setConnectionState] = useState<"idle" | "joining" | "joined" | "error" | "left">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const callWrapperRef = useRef<HTMLDivElement>(null);

  // Effect to join room when modal opens
  useEffect(() => {
    if (!isOpen || !room) return;
    
    let dailyCall: DailyCall | null = null;

    const startCall = async () => {
      console.log("Starting call for room:", room.hostSlug);
      setConnectionState("joining");
      setErrorMsg("");
      setParticipants({});
      setSessionParticipants([]);
      setSessionParticipants([]);

      // Fetch latest session participants (history)
      getLatestRoomSessionParticipants(room.hostSlug).then(p => {
          console.log("Fetched session participants:", p);
          setSessionParticipants(p);
      });

      try {
        // Generate random guest user
        const guestId = `user_${Math.floor(Math.random() * 10000)}`;
        const guestName = `Guest ${Math.floor(Math.random() * 1000)}`;

        console.log("Fetching token for guest:", guestName);
        // 1. Get Token
        const tokenRes = await fetch("/api/daily/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: room.hostSlug, 
            userId: guestId,
            username: guestName,
          }),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error("Token fetch failed:", tokenRes.status, errText);
          throw new Error(`Failed to get space token: ${tokenRes.status}`);
        }
        
        const { token } = await tokenRes.json();
        console.log("Token received, length:", token?.length);
        if (!token) throw new Error("No token received");

        // 2. Create Daily Call Object (audio-only mode)
        console.log("Creating Daily call object...");
        dailyCall = DailyIframe.createCallObject({
          audioSource: true, // We want to hear
          videoSource: false,
          subscribeToTracksAutomatically: true,
        });

        setCallObject(dailyCall);

        // 3. Setup Event Listeners
        dailyCall
          .on("joined-meeting", (e) => {
            console.log("Daily: joined-meeting event fired", e);
            setConnectionState("joined");
            updateParticipants(dailyCall);
          })
          .on("participant-joined", (e) => {
            console.log("Daily: participant-joined", e);
            updateParticipants(dailyCall);
          })
          .on("participant-updated", (e) => {
            // console.log("Daily: participant-updated", e); // Too noisy usually
            updateParticipants(dailyCall);
          })
          .on("participant-left", (e) => {
             console.log("Daily: participant-left", e);
             updateParticipants(dailyCall);
          })
          .on("left-meeting", () => {
            console.log("Daily: left-meeting");
            setConnectionState("left");
          })
          .on("error", (e) => {
            console.error("Daily error event:", e);
            setErrorMsg(e.errorMsg || "Connection error");
            setConnectionState("error");
          });

        // 4. Join
        // Construct room URL: https://<domain>.daily.co/<roomId>
        const domain = "songjam.daily.co"; // Replace with your actual daily domain
        const joinUrl = `https://${domain}/${room.hostSlug}`;
        console.log("Joining Daily room:", joinUrl);
        
        await dailyCall.join({ url: joinUrl, token });
        console.log("dailyCall.join() resolved");

      } catch (err: any) {
        console.error("Join flow exception:", err);
        setErrorMsg(err.message);
        setConnectionState("error");
      }
    };

    startCall();

    return () => {
      if (dailyCall) {
        console.log("Cleaning up Daily call...");
        dailyCall.leave().then(() => dailyCall?.destroy());
      }
      setCallObject(null);
      setConnectionState("idle");
    };
  }, [isOpen, room]);

  const updateParticipants = (call: DailyCall | null) => {
    if (!call) return;
    const p = call.participants();
    // console.log("Participants update:", Object.keys(p).length); 
    const mapped: Record<string, Participant> = {};
    Object.values(p).forEach((dp: any) => {
      // Logic to determine avatar
      // If it's the host (owner), use the room's hostSlug to generate avatar
      // If it's a guest, maybe use their ID or name
      const isHost = dp.owner || (room && dp.user_name === room.hostSlug); // Heuristic
      // Use room.hostSlug for avatar seed if they are the host, otherwise use their user_name or ID
      const seed = isHost ? room?.hostSlug : (dp.user_name || dp.user_id);
      
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
    onClose();
  };

  if (!isOpen || !room) return null;

  const speakers = Object.values(participants).filter(p => p.audio); // Simplified speaker logic
  const listeners = Object.values(participants).filter(p => !p.audio);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={handleLeave}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md pointer-events-auto overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div>
                    <h2 className="text-lg font-semibold text-white">{room.title || room.hostSlug}</h2>
                    <p className="text-xs text-zinc-400">Hosted by @{room.hostSlug}</p>
                </div>
                <button 
                  onClick={handleLeave}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 flex-1 overflow-y-auto">
                {connectionState === "joining" && (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <p>Connecting to space...</p>
                  </div>
                )}
                
                {connectionState === "error" && (
                   <div className="flex flex-col items-center justify-center py-8 text-red-400 text-center">
                     <Info className="w-8 h-8 mb-2 opacity-80" />
                     <p>Failed to join space</p>
                     <p className="text-xs text-red-400/60 mt-1">{errorMsg}</p>
                   </div>
                )}

                {connectionState === "joined" && (
                  <div className="space-y-6">
                    {/* Speakers Section */}
                    <div>
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Speakers</h3>
                        <div className="grid grid-cols-3 gap-3">
                            {/* Host indicator - usually assumed to be present or at least the top item */}
                            {speakers.length === 0 ? (
                                <p className="col-span-3 text-sm text-zinc-600 italic">No active speakers</p>
                            ) : (
                                speakers.map((p) => (
                                    <div key={p.user_id} className="flex flex-col items-center gap-2 relative">
                                        <div className="relative">

                                            {/* Active Speaker Ring */}
                                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 ring-2 ring-red-500/40 flex items-center justify-center relative z-10 overflow-hidden">
                                                {p.avatar_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img 
                                                        src={p.avatar_url} 
                                                        alt={p.user_name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-lg font-bold text-red-200">{p.user_name.charAt(0).toUpperCase()}</span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-xs text-zinc-300 truncate w-full text-center">{p.user_name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                     {/* Listeners Section */}
                    <div>
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            Listeners <span className="bg-white/10 px-1.5 rounded text-[10px]">{Math.max(listeners.length, sessionParticipants.length)}</span>
                        </h3>
                         <div className="flex flex-wrap gap-2">
                            {/* Prefer real-time listeners, fallback to historical */}
                            {(listeners.length > 0 ? listeners : sessionParticipants).map((p, idx) => (
                                <div key={p.user_id || idx} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                                    <div className="w-4 h-4 rounded-full bg-zinc-700"></div>
                                    <span className="text-xs text-zinc-300">{p.user_name || p.username || "Anonymous"}</span>
                                </div>
                            ))}
                             {listeners.length === 0 && sessionParticipants.length === 0 && (
                                <p className="text-sm text-zinc-600 italic">No other listeners yet</p>
                             )}
                         </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Control */}
              <div className="p-4 border-t border-white/5 bg-white/[0.02] flex justify-center">
                  <button 
                    onClick={handleLeave}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium text-sm"
                  >
                     <LogOut className="w-4 h-4" />
                     Leave Quietly
                  </button>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
