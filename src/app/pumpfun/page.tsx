"use client";

import React, { useState, useEffect, useRef } from "react";
import { IMessage } from '@/lib/pumpChatClient';
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Square,
  MessageSquare,
  User,
  Link as LinkIcon,
  Radio,
  Volume2,
  Mic,
  Settings,
} from "lucide-react";

// Interface is imported from pumpChatClient

export default function PumpfunChatPage() {
  const [addressInput, setAddressInput] = useState("");
  const [username, setUsername] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // AI Agent state
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [aiResponseText, setAiResponseText] = useState<string | null>(null);
  
  // Stream Info State
  const [streamInfo, setStreamInfo] = useState<{name?: string, symbol?: string,  image_uri?: string, description?: string} | null>(null);
  
  // Message Status State
  const [messageStatuses, setMessageStatuses] = useState<Record<string, 'processing' | 'answered' | 'history'>>({});
  const [aiReplies, setAiReplies] = useState<Record<string, string>>({});
  
  // Track last played timestamp to avoid replaying the same broadcast
  const lastPlayedTimestampRef = useRef<number>(0);

  const clientRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Assume generic parsed room ID for DB
  const currentTokenAddress = React.useMemo(() => {
    let roomId = addressInput.trim();
    if (roomId.includes("pump.fun/")) {
      const parts = roomId.split("/");
      roomId = parts[parts.length - 1].split("?")[0];
    }
    return roomId || "unknown";
  }, [addressInput]);

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Fetch Token Info
  useEffect(() => {
     if (!isConnected || currentTokenAddress === "unknown") return;
     
     const fetchInfo = async () => {
       try {
         const res = await fetch(`https://frontend-api.pump.fun/coins/${currentTokenAddress}`);
         if (res.ok) {
           const data = await res.json();
           setStreamInfo(data);
         }
       } catch (err) {
         console.error("Failed to fetch stream info", err);
       }
     };
     fetchInfo();
  }, [isConnected, currentTokenAddress]);

  // --- LOCAL AI ENGINE LOGIC ---
  const stateRefs = useRef({ messages, messageStatuses, isPlayingTTS });
  useEffect(() => {
    stateRefs.current = { messages, messageStatuses, isPlayingTTS };
  }, [messages, messageStatuses, isPlayingTTS]);

  const triggerAgent = async (msgToProcess: IMessage) => {
    if (stateRefs.current.isPlayingTTS) return;
    
    setActiveMessageId(msgToProcess.id);
    setIsPlayingTTS(true);
    setAiResponseText(null);

    try {
      setMessageStatuses(prev => ({ ...prev, [msgToProcess.id]: 'processing' }));

      const res = await fetch('/api/agent/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msgToProcess.message,
          username: msgToProcess.username,
        }),
      });

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();
      setAiResponseText(data.text);
      setAiReplies(prev => ({ ...prev, [msgToProcess.id]: data.text }));
      
      if (data.audio) {
        // Play locally
        const audio = new Audio(data.audio);
        audio.onended = () => {
          setIsPlayingTTS(false);
          setActiveMessageId(null);
          setAiResponseText(null);
        };
        await audio.play();
        // Mark as successfully answered locally
        setMessageStatuses(prev => ({ ...prev, [msgToProcess.id]: 'answered' }));
      } else {
        // Fallback if no audio was generated
        setTimeout(() => {
          setIsPlayingTTS(false);
          setActiveMessageId(null);
          setAiResponseText(null);
        }, 6000);
        setMessageStatuses(prev => ({ ...prev, [msgToProcess.id]: 'answered' }));
      }
    } catch (error) {
      console.error("Agent interaction failed", error);
      // Mark as answered or error so the UI can move on from the loading state
      setMessageStatuses(prev => ({ ...prev, [msgToProcess.id]: 'answered' }));
      
      // If we had text but audio failed, we should still show the text for a bit
      setTimeout(() => {
         setIsPlayingTTS(false);
         setActiveMessageId(null);
         setAiResponseText(null);
      }, 3000);
    }
  };

  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(async () => {
      const { messages: currentMessages, messageStatuses: currentStatuses, isPlayingTTS: currentPlayingTTS } = stateRefs.current;

      if (currentPlayingTTS) return; // Don't interrupt if already processing
      if (currentMessages.length === 0) return;
      
      // Look for recent messages (only the last 2 to prevent answering old backlog)
      const recentMessages = currentMessages.slice(-2);
      
      // Filter out messages that are already processing/answered, or too short/junk
      const validMessages = recentMessages.filter(msg => {
        const isHandled = currentStatuses[msg.id];
        const isTooShort = msg.message.trim().length <= 3;
        // Basic junk filters (can be expanded later)
        const isJunk = /^(lfg|gm|gn|wow|lol|lmao)$/i.test(msg.message.trim());
        
        return !isHandled && !isTooShort && !isJunk;
      });

      if (validMessages.length > 0) {
        // ALWAYS pick the LAST valid message instead of a random one
        const msgToProcess = validMessages[validMessages.length - 1];
        triggerAgent(msgToProcess);
      }
    }, 1000); // Check every 1 second to make response immediate

    return () => clearInterval(interval);
  }, [isConnected]);

  // Auto-scroll to the bottom of the chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiReplies]);

  const handleConnect = async () => {
    // Unlock Audio Context on user interaction to prevent Autoplay blocks
    try {
      const unlockAudio = new Audio("data:audio/mp3;base64,//OwgAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAABhTEFNRTMuMTAwA8EAAAAAAAAAABRAJAICAQAAwYAAAnGQb1MAAAAAAAAAAAAAAAAAAAAA");
      unlockAudio.volume = 0.01;
      unlockAudio.play().catch(e => console.warn("Audio unlock failed:", e));
    } catch(e) {}

    if (!addressInput.trim()) {
      setError("Please enter a token address or URL");
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      setIsConnecting(true);
      setError(null);
      // Only clear messages if we are not actively attempting to reconnect (i.e. if it's a fresh manual connection)
      // Since handleConnect clears history, we should avoid wiping during auto-reconnect, but for now it's fine
      // because `messages` are already wiped on fresh start. Wait, doing this will wipe the UI every time it reconnects!
      // Let's only clear messages if we are NOT currently marked as connecting. Wait, handleConnect always runs setIsConnecting(true) first.
      // We can just omit clearing messages here globally, let the user manually clear or just let SSE historical merge handle it.
      // Actually, pumpchat server sends messageHistory on connect. Wiping is fine since history repopulates.
      
      setMessages([]);
      setStreamInfo(null);
      // We purposefully DO NOT wipe messageStatuses so they accumulate across reconnects

      // Extract Room ID from URL if provided
      let roomId = addressInput.trim();
      if (roomId.includes("pump.fun/")) {
        const parts = roomId.split("/");
        roomId = parts[parts.length - 1].split("?")[0]; // simple extraction
      }

      if (clientRef.current) {
        clientRef.current.close();
      }

      const client = new EventSource(
        `/api/pumpchat?roomId=${encodeURIComponent(roomId)}&username=${encodeURIComponent(username.trim() || "Anonymous AI Developer")}`
      );

      client.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'connected') {
            setIsConnected(true);
            setIsConnecting(false);
            setError(null);
          } else if (parsed.type === 'messageHistory') {
            setMessages(parsed.data || []);
            // Allowed historical messages to be picked up by AI analysis
          } else if (parsed.type === 'message') {
            setMessages((prev) => {
              // Avoid duplicates if SSE reconnects and sends history
              if (parsed.data.id && prev.some(m => m.id === parsed.data.id)) return prev;
              const newMessages = [...prev, parsed.data];
              if (newMessages.length > 100) return newMessages.slice(-100);
              return newMessages;
            });
          } else if (parsed.type === 'error') {
            console.error("Chat error:", parsed.data);
            setError(`Connection error: ${parsed.data}. Reconnecting in 3s...`);
            setIsConnected(false);
            setIsConnecting(true);
            client.close();
            reconnectTimeoutRef.current = setTimeout(() => {
              handleConnect();
            }, 3000);
          } else if (parsed.type === 'disconnected') {
            setIsConnected(false);
            setIsConnecting(true); // Indicate reconnecting
            setError("Server disconnected. Reconnecting in 3s...");
            client.close();
            reconnectTimeoutRef.current = setTimeout(() => {
              handleConnect();
            }, 3000);
          }
        } catch (err) {
          console.error("Error parsing SSE data", err);
        }
      };

      client.onerror = (err) => {
        console.error("SSE Error:", err);
        setError("Lost connection to chat server. Reconnecting in 3s...");
        setIsConnected(false);
        setIsConnecting(true);
        client.close();
        reconnectTimeoutRef.current = setTimeout(() => {
           handleConnect();
        }, 3000);
      };

      clientRef.current = client;
    } catch (err: any) {
      setError(err.message || "Failed to initialize client");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (clientRef.current) {
      clientRef.current.close();
      clientRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setMessages([]);
    setIsPlayingTTS(false);
    setActiveMessageId(null);
    setAiResponseText(null);
    setStreamInfo(null);
    // messageStatuses and aiReplies intentionally kept to persist data
  };

  return (
    <div className="h-screen bg-[#0A0A0A] text-white flex flex-col font-sans selection:bg-red-500/30 overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/20 blur-[120px] rounded-full" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/pumpfun.png" alt="Pumpfun Agent" className="w-9 h-9 rounded-xl object-contain bg-white/5" />
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Moltspaces <span className="text-red-400 ml-1">Live Agent</span>
          </h1>
        </div>
        {/* <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="relative flex h-3 w-3">
              {isConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              )}
            </span>
            {isConnected ? "Connected" : "Disconnected"}
          </div>
        </div> */}
      </header>

      <main className="flex-1 relative z-10 p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full h-full pb-8 overflow-y-auto lg:overflow-hidden lg:pb-6">
        
        {/* Top bar with connection settings (compact) */}
        <div className="flex-shrink-0 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-xl flex flex-col items-center gap-4">
          <div className="flex flex-col sm:flex-row w-full gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LinkIcon className="h-4 w-4 text-gray-500" />
              </div>
              <input
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                disabled={isConnected || isConnecting}
                placeholder="Token Address or URL"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all disabled:opacity-50"
              />
            </div>

            <div className="flex-shrink-0 w-full sm:w-auto">
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full sm:w-auto py-2 px-6 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500 disabled:from-red-500/50 disabled:to-orange-600/50 rounded-xl font-medium text-white shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isConnecting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Start Agent
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="w-full sm:w-auto py-2 px-6 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl font-medium text-red-400 transition-all flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  Stop Agent
                </button>
              )}
            </div>
          </div>
        </div>


        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-2">
            <span className="block mt-0.5">•</span>
            <span>{error}</span>
          </div>
        )}

        {/* Main Content Area - Split Ratio 70/30 */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[500px] lg:min-h-0">
          
          {/* AI Voice Agent - Dominant View */}
          <div className="lg:w-[70%] bg-gradient-to-br from-red-950/40 to-black border border-red-500/20 rounded-3xl p-8 backdrop-blur-sm shadow-2xl flex flex-col relative overflow-hidden">
            {/* Ambient background glow */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-red-600/10 blur-[100px] rounded-full transition-opacity duration-1000 ${isPlayingTTS ? 'opacity-100' : 'opacity-30'}`} />

            <div className="relative z-10 flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                {/* {streamInfo?.image_uri ? (
                   <img src={streamInfo.image_uri} alt={streamInfo.name} className="w-14 h-14 rounded-xl border border-red-500/30 object-cover shadow-lg" />
                ) : (
                   <div className="p-3 bg-red-500/20 rounded-xl">
                     <Volume2 className="w-8 h-8 text-red-400" />
                   </div>
                )} */}
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent flex items-center gap-2">
                    {streamInfo?.name || "$CLAWK 'Claw Talk'"}
                    {streamInfo?.symbol && (
                      <span className="text-sm font-medium px-2 py-0.5 bg-white/10 text-gray-300 rounded-md ml-2 tracking-wider">
                        ${streamInfo.symbol}
                      </span>
                    )}
                  </h2>
                </div>
              </div>
              <div className="flex gap-2">
                <span className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                  {isConnected ? 'LIVE' : 'STANDBY'}
                </span>
              </div>
            </div>

            {streamInfo?.description && (
              <p className="relative z-10 text-gray-400 text-sm italic border-l-2 border-red-500/30 pl-3 mb-6 line-clamp-2 max-w-2xl">
                {streamInfo.description}
              </p>
            )}

            <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-12">
              <div className="relative mb-12">
                {/* Visualizer rings */}
                <div
                  className={`absolute inset-[-40px] rounded-full border border-red-500/30 transition-all duration-700 ease-out ${isPlayingTTS ? "scale-150 opacity-0" : "scale-100 opacity-100"}`}
                />
                <div
                  className={`absolute inset-[-80px] rounded-full border border-orange-500/20 transition-all duration-1000 delay-150 ease-out ${isPlayingTTS ? "scale-150 opacity-0" : "scale-100 opacity-100"}`}
                />
                <div
                  className={`absolute inset-[-120px] rounded-full border border-red-500/10 transition-all duration-1000 delay-300 ease-out ${isPlayingTTS ? "scale-150 opacity-0" : "scale-100 opacity-100"}`}
                />

                <div
                  className={`w-40 h-40 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(99,102,241,0.4)] transition-all duration-300 relative z-10 ${isPlayingTTS ? "scale-105 shadow-[0_0_80px_rgba(99,102,241,0.6)]" : ""}`}
                >
                  <motion.div animate={{ scale: isPlayingTTS ? [1, 1.2, 1] : 1 }} transition={{ repeat: isPlayingTTS ? Infinity : 0, duration: 2 }}>
                    <img src="/pumpfun.png" alt="Clawk" className="w-26 h-26" />
                  </motion.div>
                </div>
              </div>

              <div className="h-24 flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                  {isPlayingTTS && activeMessageId ? (
                    <motion.div
                      key="speaking"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-center"
                    >
                      <p className="text-xl text-white font-medium mb-4 flex items-center gap-3 justify-center">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
                        {aiResponseText ? "Speaking Response..." : "Generating Response..."}
                      </p>
                      
                      {/* Show the message text being answered inline for extreme clarity */}
                      <p className="text-gray-400 text-sm max-w-xl mx-auto italic border-l-2 border-red-500/30 pl-3 mb-4 line-clamp-2">
                        User: "{messages.find(m => m.id === activeMessageId)?.message || "..."}"
                      </p>

                      {aiResponseText && (
                        <p className="text-red-300 text-md max-w-xl mx-auto font-medium">
                          Agent: "{aiResponseText}"
                        </p>
                      )}
                    </motion.div>
                  ) : (
                    <motion.p
                      key="waiting"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-gray-500 text-lg"
                    >
                      {isConnected ? "Listening to chat..." : "Agent resting. Connect a token to start."}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Incoming Stream - Smaller / Side View */}
          <div className="lg:w-[30%] bg-black/40 border border-white/10 rounded-3xl flex flex-col backdrop-blur-md overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-300">
                <MessageSquare className="w-4 h-4 text-red-400" />
                Live Chat
              </h3>
              <div className="bg-white/10 px-2 py-0.5 text-[10px] rounded-full text-red-300 font-mono">
                {messages.length} msgs
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono scrollbar-thin">
              {!isConnected && messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-3 text-xs text-center p-6">
                  <Radio className="w-8 h-8 opacity-20" />
                  <p>Awaiting connection to token feed.</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-3 text-xs">
                  <div className="flex gap-1 items-center opacity-50">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse delay-75" />
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse delay-150" />
                  </div>
                  <p>Listening...</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => {
                    const isActive = msg.id === activeMessageId;
                    const isTooShort = msg.message.trim().length <= 3;
                    const replyText = aiReplies[msg.id];
                    
                    return (
                      <React.Fragment key={msg.id || i}>
                        <motion.div
                          initial={{ opacity: 0, x: -10, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          className={`pb-1 px-3 rounded-lg flex items-start sm:items-center gap-2 transition-all group ${
                            isActive 
                              ? 'bg-red-900/40 border border-red-400 shadow-[0_0_15px_rgba(99,102,241,0.3)] z-10 scale-[1.02]' 
                              : 'hover:bg-white/5 opacity-90 hover:opacity-100'
                          }`}
                        >
                        <div className="w-6 h-6 rounded-full bg-red-900/50 flex-shrink-0 flex items-center justify-center text-red-300 text-xs font-bold overflow-hidden mt-0.5 sm:mt-0">
                          {msg.profile_image ? (
                            <img src={msg.profile_image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (msg.username || "U").charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className={`font-bold text-[14px] flex-shrink-0 ${isActive ? 'text-white' : 'text-[#8A2BE2]'}`}>
                          {msg.username?.slice(0,6) || "Anonymous"}
                        </span>
                        <span className={`text-[14px] break-words flex-1 ${isActive ? 'text-white font-medium' : 'text-gray-200'}`}>
                          {msg.message}
                        </span>
                        
                        {isTooShort ? (
                           <div className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider flex items-center gap-1 bg-gray-500/20 text-gray-400 border border-gray-500/30">
                             ⊘ IGNORED
                           </div>
                        ) : (
                          messageStatuses[msg.id] && messageStatuses[msg.id] !== 'history' ? (
                            <div className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider flex items-center gap-1 ${
                              messageStatuses[msg.id] === 'processing' 
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                                : 'bg-green-500/20 text-green-400 border border-green-500/30'
                            }`}>
                              {messageStatuses[msg.id] === 'processing' ? (
                                <>
                                  <div className="w-1.5 h-1.5 border border-orange-400/50 border-t-orange-400 rounded-full animate-spin" />
                                  WAIT
                                </>
                              ) : (
                                <>✓ DONE</>
                              )}
                            </div>
                          ) : (
                            <button 
                              onClick={() => triggerAgent(msg)}
                              disabled={isPlayingTTS}
                              className="shrink-0 p-1.5 rounded-full bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-all disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-gray-400 disabled:hover:border-transparent"
                              title="Agent Reply"
                            >
                              <Mic className="w-3 h-3" />
                            </button>
                          )
                        )}
                      </motion.div>

                      {replyText && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="ml-8 mb-3 mt-1 py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2 backdrop-blur-sm self-start"
                        >
                          <div className="w-6 h-6 rounded-full bg-black/50 flex-shrink-0 overflow-hidden border border-red-500/30 mt-0.5">
                            <img src="/pumpfun.png" alt="Moltspaces" className="w-full h-full object-cover p-0.5" />
                          </div>
                          <div className="flex flex-col flex-1">
                            <span className="font-bold text-[13px] text-red-500 leading-none mb-1">
                              Claw Talk
                            </span>
                            <span className="text-[13px] text-red-100 font-medium leading-snug">
                              {replyText}
                            </span>
                          </div>
                        </motion.div>
                      )}
                      </React.Fragment>
                    );
                  })}
                </AnimatePresence>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
