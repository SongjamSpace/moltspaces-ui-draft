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

  // Audio state mock
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const clientRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.close();
      }
    };
  }, []);

  // Simulated AI Engine - picks a message every ~8 seconds to "answer"
  useEffect(() => {
    if (!isConnected || messages.length === 0) return;

    const interval = setInterval(() => {
      if (isPlayingTTS) return; // Don't interrupt if already speaking
      
      // Look for a recent un-answered message (last 10)
      const recentMessages = messages.slice(-10);
      if (recentMessages.length > 0) {
        debugger
        const randomMsg = recentMessages[Math.floor(Math.random() * recentMessages.length)];
        
        setActiveMessageId(randomMsg.id);
        setIsPlayingTTS(true);

        // Simulate speaking duration (3-6 seconds)
        const speakingDuration = 3000 + Math.random() * 3000;
        setTimeout(() => {
          setIsPlayingTTS(false);
          setActiveMessageId(null);
        }, speakingDuration);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [isConnected, messages, isPlayingTTS]);

  const handleConnect = async () => {
    if (!addressInput.trim()) {
      setError("Please enter a token address or URL");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      setMessages([]);

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
            setError(parsed.data || "Connection error occurred");
            setIsConnecting(false);
          } else if (parsed.type === 'disconnected') {
            setIsConnected(false);
            client.close();
          }
        } catch (err) {
          console.error("Error parsing SSE data", err);
        }
      };

      client.onerror = (err) => {
        console.error("SSE Error:", err);
        setError("Lost connection to chat server or invalid token address");
        setIsConnected(false);
        setIsConnecting(false);
        client.close();
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
    setIsConnected(false);
    setMessages([]);
    setIsPlayingTTS(false);
    setActiveMessageId(null);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Moltspaces <span className="text-indigo-400 ml-1">Live Agent</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
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
        </div>
      </header>

      <main className="flex-1 relative z-10 p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full h-full pb-8">
        
        {/* Top bar with connection settings (compact) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-xl flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 flex gap-4 w-full">
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
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex-shrink-0 w-full sm:w-auto">
            {!isConnected ? (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full sm:w-auto py-2 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:from-indigo-500/50 disabled:to-purple-600/50 rounded-xl font-medium text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
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

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-2">
            <span className="block mt-0.5">•</span>
            <span>{error}</span>
          </div>
        )}

        {/* Main Content Area - Split Ratio 70/30 */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[500px]">
          
          {/* AI Voice Agent - Dominant View */}
          <div className="lg:w-[70%] bg-gradient-to-br from-indigo-950/40 to-black border border-indigo-500/20 rounded-3xl p-8 backdrop-blur-sm shadow-2xl flex flex-col relative overflow-hidden">
            {/* Ambient background glow */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-indigo-600/10 blur-[100px] rounded-full transition-opacity duration-1000 ${isPlayingTTS ? 'opacity-100' : 'opacity-30'}`} />

            <div className="relative z-10 flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <Volume2 className="w-6 h-6 text-indigo-400" />
                  </div>
                  moltspaces
                </h2>
                <p className="text-indigo-300 text-sm mt-1 ml-12">Voice Agent Active</p>
              </div>
              <div className="flex gap-2">
                <span className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                  {isConnected ? 'LIVE' : 'STANDBY'}
                </span>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-12">
              <div className="relative mb-12">
                {/* Visualizer rings */}
                <div
                  className={`absolute inset-[-40px] rounded-full border border-indigo-500/30 transition-all duration-700 ease-out ${isPlayingTTS ? "scale-150 opacity-0" : "scale-100 opacity-100"}`}
                />
                <div
                  className={`absolute inset-[-80px] rounded-full border border-purple-500/20 transition-all duration-1000 delay-150 ease-out ${isPlayingTTS ? "scale-150 opacity-0" : "scale-100 opacity-100"}`}
                />
                <div
                  className={`absolute inset-[-120px] rounded-full border border-indigo-500/10 transition-all duration-1000 delay-300 ease-out ${isPlayingTTS ? "scale-150 opacity-0" : "scale-100 opacity-100"}`}
                />

                <div
                  className={`w-40 h-40 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_60px_rgba(99,102,241,0.4)] transition-all duration-300 relative z-10 ${isPlayingTTS ? "scale-105 shadow-[0_0_80px_rgba(99,102,241,0.6)]" : ""}`}
                >
                  <motion.div animate={{ scale: isPlayingTTS ? [1, 1.2, 1] : 1 }} transition={{ repeat: isPlayingTTS ? Infinity : 0, duration: 2 }}>
                    <Mic className="w-16 h-16 text-white" />
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
                      <p className="text-xl text-white font-medium mb-2 flex items-center gap-3 justify-center">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
                        Answering Chat Message...
                      </p>
                      
                      {/* Show the message text being answered inline for extreme clarity */}
                      <p className="text-indigo-300 text-sm max-w-md mx-auto italic border-l-2 border-indigo-500/50 pl-3">
                        "{messages.find(m => m.id === activeMessageId)?.message || "..."}"
                      </p>
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
            
            {/* Mock Audio Player Controls */}
            <div className="mt-auto pt-6 border-t border-white/10 flex items-center gap-6 text-gray-500 opacity-70">
              <button disabled className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <Play className="w-5 h-5 ml-1 text-white" />
              </button>
              <div className="flex-1 flex flex-col gap-2">
                 <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                   <div className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ${isPlayingTTS ? 'w-[45%]' : 'w-0'}`}></div>
                 </div>
                 <div className="flex justify-between text-[10px] font-medium tracking-wider">
                   <span>LIVE TTS FEED</span>
                   <span className="text-indigo-400">{isPlayingTTS ? 'GENERATING' : 'IDLE'}</span>
                 </div>
              </div>
            </div>
          </div>

          {/* Incoming Stream - Smaller / Side View */}
          <div className="lg:w-[30%] bg-black/40 border border-white/10 rounded-3xl flex flex-col backdrop-blur-md overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-300">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Live Chat Feed
              </h3>
              <div className="bg-white/10 px-2 py-0.5 text-[10px] rounded-full text-indigo-300 font-mono">
                {messages.length} msgs
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
              {!isConnected && messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-3 text-xs text-center p-6">
                  <Radio className="w-8 h-8 opacity-20" />
                  <p>Awaiting connection to token feed.</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-3 text-xs">
                  <div className="flex gap-1 items-center opacity-50">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse delay-75" />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse delay-150" />
                  </div>
                  <p>Listening...</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => {
                    const isActive = msg.id === activeMessageId;
                    
                    return (
                      <motion.div
                        key={msg.id || i}
                        initial={{ opacity: 0, x: -10, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        className={`border p-3 rounded-2xl flex flex-col gap-1.5 transition-all ${
                          isActive 
                            ? 'bg-indigo-900/40 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)] z-10 scale-[1.02]' 
                            : 'bg-white/5 border-white/5 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 max-w-[70%]">
                            <div className="w-5 h-5 rounded-full bg-indigo-900/50 flex-shrink-0 flex items-center justify-center text-indigo-300 text-[9px] font-bold overflow-hidden">
                              {msg.profile_image ? (
                                <img src={msg.profile_image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                (msg.username || "U").charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className={`font-semibold text-[10px] truncate max-w-full ${isActive ? 'text-white' : 'text-indigo-300'}`}>
                              {msg.username || "Anonymous"}
                            </span>
                          </div>
                          <span className="text-[9px] text-gray-500 flex-shrink-0">
                            {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p className={`text-xs break-words pl-7 leading-relaxed ${isActive ? 'text-white font-medium' : 'text-gray-400'}`}>
                          {msg.message}
                        </p>
                      </motion.div>
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
