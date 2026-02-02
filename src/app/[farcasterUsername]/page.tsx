'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { DailyProvider, useDaily, useParticipantIds, useLocalParticipant, DailyAudio } from '@daily-co/daily-react';
import { useConversation } from '@elevenlabs/react';
import VoiceOrb from '@/components/songjam/VoiceOrb';
import SpaceGraphDOM from '@/components/songjam/SpaceGraphDOM';
import { getEmpireBuilderByHostSlug, EmpireBuilder } from '@/services/db/empireBuilder.db';
import SpaceChat from '@/components/songjam/SpaceChat';
import MusicConsole from '@/components/songjam/MusicConsole';
import MusicPlayer from '@/components/songjam/MusicPlayer';
import { 
    goLive, 
    endSpace,
    subscribeToLiveSpace,
    LiveSpaceDoc,
    addParticipant,
    removeParticipant,
    subscribeToSessionParticipants,
    SpaceParticipant
} from '@/services/db/liveSpaces.db';
import { NeynarAuthButton, useNeynarContext, SIWN_variant } from '@neynar/react';
import { Mic, MicOff, Users, LogOut, Radio, Crown, Loader2, Send, Wifi, MessageCircle, X } from 'lucide-react';
import { neynarClient } from '@/services/neynar-client';

// Loading component
const LoadingSpinner = () => (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
        >
            <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
            <p className="text-zinc-400">Loading MoltSpace...</p>
        </motion.div>
    </div>
);

// Not found component
const NotFound = ({ username }: { username: string }) => (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
        >
            <h1 className="text-4xl font-bold text-white mb-4">MoltSpace not found</h1>
            <p className="text-zinc-400 mb-6">
                No host found with username @{username}
            </p>
            <a
                href="/"
                className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-semibold transition-colors"
            >
                Back to MoltSpaces
            </a>
        </motion.div>
    </div>
);

// Token not deployed component
const TokenNotDeployed = ({ hostData }: { hostData: EmpireBuilder }) => (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
        >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                <Crown className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">{hostData.name}</h1>
            <p className="text-slate-400 mb-6">
                This host&apos;s token is not yet deployed. Check back soon!
            </p>
            <p className="text-sm text-slate-500">
                Status: {hostData.deploymentStatus || 'pending'}
            </p>
        </motion.div>
    </div>
);

// Connect Farcaster prompt component
const ConnectFarcasterPrompt = ({ 
    hostData, 
    liveSpace 
}: { 
    hostData: EmpireBuilder;
    liveSpace: LiveSpaceDoc | null;
}) => (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
            <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-3xl" />
        </div>
        
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 max-w-md w-full"
        >
            <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 p-8 text-center">
                {hostData.imageUrl && (
                    <motion.img 
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        src={hostData.imageUrl}
                        alt={hostData.name}
                        className={`w-24 h-24 mx-auto mb-6 rounded-full border-4 shadow-xl ${
                            liveSpace ? 'border-green-500 shadow-green-500/20' : 'border-purple-500 shadow-purple-500/20'
                        }`}
                    />
                )}
                
                <h1 className="text-3xl font-bold text-white mb-2">
                    {hostData.name}&apos;s Space
                </h1>
                <p className="text-slate-400 mb-4">
                    @{hostData.hostSlug} • ${hostData.symbol}
                </p>
                
                {/* Live badge when space is active */}
                {liveSpace && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            Live Now • {liveSpace.participantCount} listening
                        </span>
                    </div>
                )}
                
                <p className="text-slate-300 mb-6">
                    {liveSpace 
                        ? 'Sign in with Farcaster to join this space'
                        : 'Connect your Farcaster account to join or start this space'
                    }
                </p>
                
                <div className="flex justify-center">
                    <NeynarAuthButton variant={SIWN_variant.FARCASTER} />
                </div>
            </div>
        </motion.div>
    </div>
);

// Participant bubble component
interface ParticipantInfo {
    pfpUrl?: string;
    displayName?: string;
    username?: string;
}

const ParticipantBubble = ({ 
    id, 
    isHost, 
    isLocal, 
    userInfo 
}: { 
    id: string; 
    isHost: boolean; 
    isLocal: boolean;
    userInfo?: ParticipantInfo;
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative group"
        >
            <div className={`
                w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 
                ${isHost 
                    ? 'bg-gradient-to-br from-purple-500 to-cyan-500 p-1' 
                    : 'bg-slate-800 border-2 border-slate-700'
                }
            `}>
                <div className={`
                    w-full h-full rounded-full flex items-center justify-center overflow-hidden
                    ${isHost ? 'bg-slate-900' : ''}
                `}>
                    {userInfo?.pfpUrl ? (
                        <img 
                            src={userInfo.pfpUrl} 
                            alt={userInfo.displayName || userInfo.username || 'Participant'}
                            className="w-full h-full object-cover rounded-full"
                        />
                    ) : (
                        <span className="text-xl font-bold text-white">
                            {isLocal ? 'You' : '?'}
                        </span>
                    )}
                </div>
            </div>
            {isHost && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full text-white text-[10px] font-bold uppercase">
                    Host
                </div>
            )}
            {/* Display name tooltip on hover */}
            {userInfo?.displayName && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 rounded text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {userInfo.displayName}
                </div>
            )}
        </motion.div>
    );
};

interface HostProfile {
    username: string;
    displayName: string;
    pfpUrl?: string;
    twitterId: string;
}

// Main room content component
const RoomContent = ({ 
    hostProfile,
    liveSpace,
    isHost,
    onLeave,
    onEndSpace,
    currentUserInfo,
    activeSessions,
    daily
}: { 
    hostProfile: HostProfile;
    liveSpace: LiveSpaceDoc;
    isHost: boolean;
    onLeave: () => void;
    onEndSpace: () => void;
    currentUserInfo?: ParticipantInfo;
    activeSessions: SpaceParticipant[];
    daily: ReturnType<typeof useDaily>;
}) => {
    const localParticipant = useLocalParticipant();
    const participantIds = useParticipantIds();
    const [isMicEnabled, setIsMicEnabled] = useState(false);
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

    const handleToggleMic = useCallback(() => {
        if (!daily) return;
        const newState = !isMicEnabled;
        daily.setLocalAudio(newState);
        setIsMicEnabled(newState);
    }, [daily, isMicEnabled]);

    const handleLeave = useCallback(() => {
        daily?.leave();
        onLeave();
    }, [daily, onLeave]);

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-white">
            <DailyAudio maxSpeakers={10} autoSubscribeActiveSpeaker />
            <MusicPlayer dailyCallObject={daily} />
            
            {/* Header - stacks vertically on mobile */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 sm:p-6 border-b border-slate-800 gap-3 sm:gap-0"
            >
                {/* Top row: Profile info */}
                <div className="flex items-center gap-3 sm:gap-4">
                    {hostProfile.pfpUrl ? (
                         <img 
                            src={hostProfile.pfpUrl} 
                            alt={hostProfile.displayName}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-purple-500 flex-shrink-0"
                        />
                    ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-purple-500 bg-slate-800 flex items-center justify-center flex-shrink-0">
                             <span className="text-lg sm:text-xl font-bold">{hostProfile.displayName.charAt(0)}</span>
                        </div>
                    )}
                   
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent truncate">
                            {liveSpace.title || `${hostProfile.displayName}'s Space`}
                        </h1>
                        <p className="text-slate-400 text-xs sm:text-sm">@{hostProfile.username}</p>
                    </div>
                </div>
                
                {/* Bottom row on mobile: Controls */}
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-slate-800 rounded-full text-slate-300 text-sm">
                        <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>{participantIds.length}</span>
                    </div>
                    
                    {/* Music Console - Host Only */}
                    {isHost && (
                        <MusicConsole 
                            hostTwitterId={hostProfile.twitterId} 
                            dailyCallObject={daily}
                            hostUsername={hostProfile.username}
                        />
                    )}
                    
                    <button
                        onClick={handleToggleMic}
                        className={`
                            p-2.5 sm:p-3 rounded-full transition-all
                            ${isMicEnabled 
                                ? 'bg-green-500 hover:bg-green-600' 
                                : 'bg-slate-700 hover:bg-slate-600'
                            }
                        `}
                    >
                        {isMicEnabled ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                    
                    {isHost && (
                        <button
                            onClick={onEndSpace}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all text-xs sm:text-sm font-medium"
                        >
                            End Space
                        </button>
                    )}
                    
                    <button
                        onClick={handleLeave}
                        className="p-2.5 sm:p-3 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
                    >
                        <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>
            </motion.div>

            {/* Main content - Participants */}
            <div className="flex-1 overflow-hidden relative flex flex-row">
                <div className="flex-1 relative">
                    {/* Background effects */}
                    <div className="absolute inset-0 z-0">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-900/10 rounded-full blur-[100px]" />
                    </div>

                    <div className="relative z-10 w-full h-full">
                         {/* Space Graph Visualization */}
                         <SpaceGraphDOM 
                            hostProfile={hostProfile}
                            activeSessions={activeSessions}
                         />
                    </div>
                </div>

                {/* Right Side Chat Panel - Desktop */}
                <div className="hidden md:block h-full relative z-20">
                    <SpaceChat 
                        currentUser={{
                            username: currentUserInfo?.username || 'Guest',
                            displayName: currentUserInfo?.displayName,
                            pfpUrl: currentUserInfo?.pfpUrl
                        }}
                    />
                </div>
            </div>

            {/* Mobile Chat Toggle Button */}
            <button
                onClick={() => setIsMobileChatOpen(true)}
                className="md:hidden fixed bottom-6 right-6 z-30 p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg shadow-purple-500/30 transition-all"
            >
                <MessageCircle className="w-6 h-6" />
            </button>

            {/* Mobile Chat Slide-up Panel */}
            <AnimatePresence>
                {isMobileChatOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileChatOpen(false)}
                            className="md:hidden fixed inset-0 bg-black/50 z-40"
                        />
                        
                        {/* Chat Panel */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="md:hidden fixed bottom-0 left-0 right-0 h-[75vh] bg-slate-900 rounded-t-3xl z-50 overflow-hidden"
                        >
                            {/* Handle bar and close button */}
                            <div className="flex items-center justify-between p-4 border-b border-slate-800">
                                <div className="w-10" /> {/* Spacer */}
                                <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
                                <button
                                    onClick={() => setIsMobileChatOpen(false)}
                                    className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                            
                            {/* Chat content */}
                            <div className="h-[calc(75vh-60px)]">
                                <SpaceChat 
                                    currentUser={{
                                        username: currentUserInfo?.username || 'Guest',
                                        displayName: currentUserInfo?.displayName,
                                        pfpUrl: currentUserInfo?.pfpUrl
                                    }}
                                />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </div>
    );
};

// Pre-join lobby component - shown when space is live and user wants to join
const PreJoinLobby = ({ 
    hostData, 
    liveSpace,
    onJoin, 
    isJoining,
    isAuthenticated,
    neynarUser
}: { 
    hostData: EmpireBuilder;
    liveSpace: LiveSpaceDoc;
    onJoin: () => void;
    isJoining: boolean;
    isAuthenticated: boolean;
    neynarUser: { pfp_url?: string; display_name?: string; username?: string } | null;
}) => {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-3xl" />
            </div>
            
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 max-w-md w-full"
            >
                <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 p-8 text-center">
                    {hostData.imageUrl && (
                        <motion.img 
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            src={hostData.imageUrl}
                            alt={hostData.name}
                            className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-green-500 shadow-xl shadow-green-500/20"
                        />
                    )}
                    
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {liveSpace.title || `${hostData.name}'s Space`}
                    </h1>
                    <p className="text-slate-400 mb-6">
                        @{hostData.hostSlug} • ${hostData.symbol}
                    </p>
                    
                    {/* Live badge */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            Live Now • {liveSpace.participantCount} listening
                        </span>
                    </div>
                    
                    {/* Show auth button if not authenticated */}
                    {!isAuthenticated || !neynarUser ? (
                        <>
                            <p className="text-slate-300 mb-6">
                                Sign in with Farcaster to join this space
                            </p>
                            <NeynarAuthButton variant={SIWN_variant.FARCASTER} />
                        </>
                    ) : (
                        <>
                            {/* Show user info */}
                            <div className="flex items-center justify-center gap-3 mb-6 p-3 bg-slate-800/50 rounded-xl">
                                {neynarUser.pfp_url && (
                                    <img 
                                        src={neynarUser.pfp_url} 
                                        alt={neynarUser.display_name || neynarUser.username}
                                        className="w-10 h-10 rounded-full border-2 border-purple-500"
                                    />
                                )}
                                <div className="text-left">
                                    <p className="text-white font-medium">{neynarUser.display_name}</p>
                                    <p className="text-slate-400 text-sm">@{neynarUser.username}</p>
                                </div>
                            </div>
                            
                            <button
                                onClick={onJoin}
                                disabled={isJoining}
                                className="w-full py-4 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white rounded-2xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isJoining ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Joining...
                                    </>
                                ) : (
                                    <>
                                        <Radio className="w-5 h-5" />
                                        Join Space
                                    </>
                                )}
                            </button>
                            
                            <p className="text-slate-500 text-sm mt-4">
                                You will join muted. Your microphone will be requested when you join.
                            </p>
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// Host Go Live lobby - shown when host visits and space is offline
const HostGoLiveLobby = ({ 
    hostData, 
    onGoLive, 
    isGoingLive,
    orbState,
    inputVolume,
    outputVolume,
    onOrbClick,
    statusText
}: { 
    hostData: EmpireBuilder;
    onGoLive: () => void;
    isGoingLive: boolean;
    orbState: 'idle' | 'listening' | 'speaking' | 'transitioning';
    inputVolume: number;
    outputVolume: number;
    onOrbClick: () => void;
    statusText: string;
}) => {
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col p-6">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-3xl" />
            </div>
            
            <div className="flex-1 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 max-w-md w-full"
                >
                    <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 p-8 text-center">
                        {hostData.imageUrl && (
                            <motion.img 
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                src={hostData.imageUrl}
                                alt={hostData.name}
                                className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-purple-500 shadow-xl shadow-purple-500/20"
                            />
                        )}
                        
                        <h1 className="text-3xl font-bold text-white mb-2">
                            Your Space
                        </h1>
                        <p className="text-slate-400 mb-6">
                            @{hostData.hostSlug} • ${hostData.symbol}
                        </p>
                        
                        <div className="flex items-center justify-center gap-2 mb-8">
                            <span className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-400 rounded-full text-sm font-medium">
                                <span className="w-2 h-2 rounded-full bg-slate-500" />
                                Currently Offline
                            </span>
                        </div>
                        
                        <button
                            onClick={onGoLive}
                            disabled={isGoingLive}
                            className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-2xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isGoingLive ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Going Live...
                                </>
                            ) : (
                                <>
                                    <Wifi className="w-5 h-5" />
                                    Go Live
                                </>
                            )}
                        </button>
                        
                        <p className="text-slate-500 text-sm mt-4">
                            Start your space and invite your community
                        </p>
                    </div>
                </motion.div>
            </div>

            {/* Bottom Orb Section */}
            <footer className="relative z-10 p-8 pb-12">
                <div className="flex flex-col items-center gap-4">
                    <VoiceOrb
                        state={orbState}
                        inputVolume={inputVolume}
                        outputVolume={outputVolume}
                        onClick={onOrbClick}
                        className="w-20 h-20"
                    />
                    
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={statusText}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-sm text-slate-400"
                        >
                            {statusText}
                        </motion.span>
                    </AnimatePresence>
                </div>
            </footer>
        </div>
    );
};

// Non-host waiting lobby - shown when non-host visits and space is offline
const RequestHostLobby = ({ 
    hostData,
    onRequestStart,
    requestSent
}: { 
    hostData: EmpireBuilder;
    onRequestStart: () => void;
    requestSent: boolean;
}) => {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-3xl" />
            </div>
            
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 max-w-md w-full"
            >
                <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 p-8 text-center">
                    {hostData.imageUrl && (
                        <motion.img 
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            src={hostData.imageUrl}
                            alt={hostData.name}
                            className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-slate-600 shadow-xl opacity-75"
                        />
                    )}
                    
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {hostData.name}&apos;s Space
                    </h1>
                    <p className="text-slate-400 mb-6">
                        @{hostData.hostSlug} • ${hostData.symbol}
                    </p>
                    
                    <div className="flex items-center justify-center gap-2 mb-8">
                        <span className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-400 rounded-full text-sm font-medium">
                            <span className="w-2 h-2 rounded-full bg-slate-500" />
                            Host is Offline
                        </span>
                    </div>
                    
                    {requestSent ? (
                        <div className="w-full py-4 bg-green-500/20 text-green-400 rounded-2xl font-medium flex items-center justify-center gap-2">
                            <Send className="w-5 h-5" />
                            Request sent to @{hostData.hostSlug}
                        </div>
                    ) : (
                        <button
                            onClick={onRequestStart}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Send className="w-5 h-5" />
                            Request Host to Go Live
                        </button>
                    )}
                    
                    <p className="text-slate-500 text-sm mt-4">
                        {requestSent 
                            ? "We'll notify you when the space goes live"
                            : "Send a notification to the host via Farcaster"
                        }
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

type AgentState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | null;

// Main page component (wrapped with DailyProvider)
const HostSpaceContent = () => {
    const params = useParams();
    const router = useRouter();
    const farcasterUsername = params.farcasterUsername as string;
    const { user: neynarUser, isAuthenticated } = useNeynarContext();
    
    const daily = useDaily();
    
    const [hostData, setHostData] = useState<EmpireBuilder | null>(null);
    const [liveSpace, setLiveSpace] = useState<LiveSpaceDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [roomState, setRoomState] = useState<'lobby' | 'joining' | 'joined'>('lobby');
    const [error, setError] = useState<string | null>(null);
    const [isGoingLive, setIsGoingLive] = useState(false);
    const [requestSent, setRequestSent] = useState(false);

    const [activeSessions, setActiveSessions] = useState<SpaceParticipant[]>([]);
    const sessionIdRef = useRef<string | null>(null);

    // Voice agent state
    const [agentState, setAgentState] = useState<AgentState>('disconnected');
    const [orbState, setOrbState] = useState<'idle' | 'listening' | 'speaking' | 'transitioning'>('idle');
    const [inputVolume, setInputVolume] = useState(0);
    const [outputVolume, setOutputVolume] = useState(0);
    const [statusText, setStatusText] = useState('Tap to Talk');
    
    const animationFrameRef = useRef<number | null>(null);
    const conversationRef = useRef<ReturnType<typeof useConversation> | null>(null);

    // ElevenLabs conversation setup
    const conversation = useConversation({
        dynamicVariables: {
            isFarcasterConnected: isAuthenticated,
            hostName: neynarUser?.display_name || neynarUser?.username || '',
        },
        onConnect: () => {
            setAgentState('connected');
            setOrbState('listening');
            setStatusText('Listening...');
        },
        onDisconnect: () => {
            setAgentState('disconnected');
            setOrbState('idle');
            setStatusText('Tap to Talk');
        },
        onMessage: (message) => console.log("Message:", message),
        onError: (error) => {
            console.error("ElevenLabs Error:", error);
            setAgentState('disconnected');
            setOrbState('idle');
            setStatusText('Tap to Talk');
        },
    });

    conversationRef.current = conversation;

    // Fetch host data
    useEffect(() => {
        const fetchHost = async () => {
            try {
                const host = await getEmpireBuilderByHostSlug(farcasterUsername);
                setHostData(host);
            } catch (err) {
                console.error('Error fetching host:', err);
                setError('Failed to load host data');
            } finally {
                setLoading(false);
            }
        };
        
        if (farcasterUsername) {
            fetchHost();
        }
    }, [farcasterUsername]);

    // Subscribe to live space updates
    useEffect(() => {
        if (!farcasterUsername) return;

        const unsubscribe = subscribeToLiveSpace(farcasterUsername, (space) => {
            setLiveSpace(space);
            // If space ends while we're joined, go back to lobby
            if (!space && roomState === 'joined') {
                daily?.leave();
                setRoomState('lobby');
            }
        });

        return () => unsubscribe();
    }, [farcasterUsername, roomState, daily]);

    // Subscribe to active participants for the graph
    useEffect(() => {
        if (!liveSpace?.currentSessionId) {
            setActiveSessions([]);
            return;
        }

        const unsubscribe = subscribeToSessionParticipants(liveSpace.currentSessionId, (participants) => {
            setActiveSessions(participants);
        });

        return () => unsubscribe();
    }, [liveSpace?.currentSessionId]);

    // Handle session cleanup on unmount
    useEffect(() => {
        return () => {
            if (sessionIdRef.current) {
                removeParticipant(sessionIdRef.current);
            }
        };
    }, []);

    // Check if current user is the host (compare Farcaster FIDs)
    const isHost = hostData && neynarUser && hostData.fid === neynarUser.fid?.toString();

    // Handle host going live
    const handleGoLive = useCallback(async () => {
        if (!hostData || !daily || !neynarUser) return;
        
        setIsGoingLive(true);
        
        try {
            // Create a Daily room
            const response = await fetch('/api/daily/room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    properties: {
                        exp: Math.round(Date.now() / 1000) + 24 * 60 * 60,
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to create room');
            }
            
            const roomData = await response.json();
            
            // Write to Firebase so others can join the same room
            const newLiveSpace = await goLive({
                hostSlug: hostData.hostSlug,
                hostFid: neynarUser.fid.toString(),
                dailyRoomUrl: roomData.url,
            });
            
            // Request mic permission
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Join the Daily room
            await daily.join({
                url: roomData.url,
                userName: neynarUser.display_name || neynarUser.username || 'Host',
                userData: {
                    isHost: true,
                    farcasterUsername: neynarUser.username,
                    displayName: neynarUser.display_name,
                    pfpUrl: neynarUser.pfp_url,
                    fid: neynarUser.fid
                }
            });
            
            // Create participant record
            if (neynarUser.fid && newLiveSpace.currentSessionId) {
                const participantId = await addParticipant({
                    sessionId: newLiveSpace.currentSessionId,
                    hostSlug: hostData.hostSlug,
                    userFid: neynarUser.fid.toString(),
                    farcasterUsername: neynarUser.username || '',
                    displayName: neynarUser.display_name || '',
                    pfpUrl: neynarUser.pfp_url || '',
                    role: 'host'
                });
                sessionIdRef.current = participantId;
            }
            
            // Start muted
            daily.setLocalAudio(false);
            
            setRoomState('joined');
        } catch (err) {
            console.error('Error going live:', err);
            setError('Failed to go live');
        } finally {
            setIsGoingLive(false);
        }
    }, [hostData, daily, neynarUser]);

    // Handle joining an existing live space
    const handleJoinRoom = useCallback(async () => {
        if (!hostData || !daily || !liveSpace) return;
        
        setRoomState('joining');
        
        try {
            // Request mic permission
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Join the existing Daily room from Firebase
            await daily.join({
                url: liveSpace.dailyRoomUrl,
                userName: neynarUser?.display_name || neynarUser?.username || 'Guest',
                userData: {
                    isHost: false, // Explicitly false for joiners
                    farcasterUsername: neynarUser?.username,
                    displayName: neynarUser?.display_name,
                    pfpUrl: neynarUser?.pfp_url,
                    fid: neynarUser?.fid
                }
            });

            // Create participant record
            if (neynarUser?.fid && liveSpace.currentSessionId) {
                const participantId = await addParticipant({
                    sessionId: liveSpace.currentSessionId,
                    hostSlug: hostData.hostSlug,
                    userFid: neynarUser.fid.toString(),
                    farcasterUsername: neynarUser.username || '',
                    displayName: neynarUser.display_name || '',
                    pfpUrl: neynarUser.pfp_url || '',
                    role: 'speaker'
                });
                sessionIdRef.current = participantId;
            }
            
            // Start muted
            daily.setLocalAudio(false);
            
            setRoomState('joined');
        } catch (err) {
            console.error('Error joining room:', err);
            setError('Failed to join room');
            setRoomState('lobby');
        }
    }, [hostData, daily, liveSpace, neynarUser]);

    // Handle host ending the space
    const handleEndSpace = useCallback(async () => {
        if (!liveSpace) return;
        
        try {
            await endSpace(liveSpace.hostSlug);
            daily?.leave();
            if (sessionIdRef.current) {
                await removeParticipant(sessionIdRef.current);
                sessionIdRef.current = null;
            }
            setRoomState('lobby');
        } catch (err) {
            console.error('Error ending space:', err);
        }
    }, [liveSpace, daily]);

    // Handle leaving the room
    const handleLeaveRoom = useCallback(async () => {
        if (sessionIdRef.current) {
            await removeParticipant(sessionIdRef.current);
            sessionIdRef.current = null;
        }
        setRoomState('lobby');
    }, []);

    // Handle requesting host to start (placeholder - does nothing for now)
    const handleRequestStart = useCallback(async () => {
        if (!hostData || !neynarUser?.signer_uuid) return;
        
        // try {
        //     await neynarClient.postCast(
        //         neynarUser.signer_uuid,
        //         `@${hostData.farcasterUsername} please go live! I'm waiting in your space.`,
        //         []
        //     );
        //     setRequestSent(true);
        // } catch (err) {
        //     console.error('Error sending request:', err);
        //     // Optionally set an error state here if you want to show feedback to the user
        // }
    }, [hostData, neynarUser]);

    // Volume monitoring loop for ElevenLabs
    useEffect(() => {
        if (agentState !== 'connected') {
            setInputVolume(0);
            setOutputVolume(0);
            return;
        }

        const updateVolumes = () => {
            const conv = conversationRef.current;
            const rawInput = conv?.getInputVolume?.() ?? 0;
            const rawOutput = conv?.getOutputVolume?.() ?? 0;

            const normalizedInput = Math.min(1.0, Math.pow(rawInput, 0.5) * 2.5);
            const normalizedOutput = Math.min(1.0, Math.pow(rawOutput, 0.5) * 2.5);

            setInputVolume(normalizedInput);
            setOutputVolume(normalizedOutput);

            if (normalizedOutput > normalizedInput && normalizedOutput > 0.05) {
                setOrbState('speaking');
                setStatusText('Speaking...');
            } else if (normalizedInput > 0.05) {
                setOrbState('listening');
                setStatusText('Listening...');
            } else if (agentState === 'connected') {
                setOrbState('listening');
                setStatusText('Listening...');
            }

            animationFrameRef.current = requestAnimationFrame(updateVolumes);
        };

        updateVolumes();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [agentState]);

    const startConversation = useCallback(async () => {
        try {
            setAgentState('connecting');
            setStatusText('Connecting...');

            await navigator.mediaDevices.getUserMedia({ audio: true });

            await conversation.startSession({
                agentId: 'agent_3201kes1g6w6fhbrna2t2yv26rkv',
                connectionType: 'websocket',
                clientTools: {
                    start_space: async () => {
                        setOrbState('transitioning');
                        setStatusText('Going Live...');
                        
                        try {
                            await handleGoLive();
                            return 'Space is now live! You are broadcasting.';
                        } catch (error) {
                            console.error('Error going live:', error);
                            setOrbState('listening');
                            setStatusText('Failed to go live');
                            return 'Failed to start the space. Please try again.';
                        }
                    }
                }
            });
        } catch (error) {
            console.error("Error starting conversation:", error);
            setAgentState('disconnected');
            setOrbState('idle');
            setStatusText('Tap to Talk');
        }
    }, [conversation, handleGoLive]);

    const handleOrbClick = useCallback(() => {
        if (orbState === 'transitioning') return;

        if (agentState === 'disconnected' || agentState === null) {
            startConversation();
        } else if (agentState === 'connected') {
            conversation.endSession();
        }
    }, [agentState, orbState, conversation, startConversation]);

    // Loading state
    if (loading) {
        return <LoadingSpinner />;
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button 
                        onClick={() => router.push('/')}
                        className="text-red-400 hover:text-red-300"
                    >
                        Back to MoltSpaces
                    </button>
                </div>
            </div>
        );
    }

    // Not found state
    if (!hostData) {
        return <NotFound username={farcasterUsername} />;
    }

    // Token not deployed state
    if (hostData.deploymentStatus !== 'deployed') {
        return <TokenNotDeployed hostData={hostData} />;
    }

    // Not authenticated with Farcaster - show connect prompt
    if (!isAuthenticated || !neynarUser) {
        return <ConnectFarcasterPrompt hostData={hostData} liveSpace={liveSpace} />;
    }

    // Joined state - show the room
    if (roomState === 'joined' && liveSpace) {
        // Construct Host Profile Logic
        let hostProfile = {
             username: hostData.hostSlug,
             displayName: hostData.name, // Fallback
             pfpUrl: hostData.imageUrl
        };

        if (isHost && neynarUser) {
             // 1. If I am the host, use my live data
             hostProfile = {
                 username: neynarUser.username,
                 displayName: neynarUser.display_name || neynarUser.username,
                 pfpUrl: neynarUser.pfp_url || hostData.imageUrl
             };
        } else {
             // 2. If I am a guest, try to find the host in active sessions
             // The host session should have the same username/hostSlug
             const hostSession = activeSessions.find(s => s.status === 'active' && s.farcasterUsername === hostData.hostSlug);
             if (hostSession) {
                  hostProfile = {
                      username: hostSession.farcasterUsername,
                      displayName: hostSession.displayName,
                      pfpUrl: hostSession.pfpUrl
                  };
             } else if (liveSpace.hostFid) {
                  // Maybe check by FID?
                  // ...
                  // Stick to fallback for now if session not found
             }
        }

        return (
            <RoomContent 
                hostProfile={{...hostProfile, twitterId: hostData.twitterId}}
                liveSpace={liveSpace}
                isHost={isHost || false}
                onLeave={handleLeaveRoom}
                onEndSpace={handleEndSpace}
                currentUserInfo={{
                    pfpUrl: neynarUser?.pfp_url,
                    displayName: neynarUser?.display_name,
                    username: neynarUser?.username,
                }}
                activeSessions={activeSessions}
                daily={daily}
            />
        );
    }

    // Space is live - show join lobby
    if (liveSpace) {
        return (
            <PreJoinLobby 
                hostData={hostData}
                liveSpace={liveSpace}
                onJoin={handleJoinRoom}
                isJoining={roomState === 'joining'}
                isAuthenticated={isAuthenticated}
                neynarUser={neynarUser}
            />
        );
    }

    // Space is offline
    if (isHost) {
        // Host sees "Go Live" button
        return (
            <HostGoLiveLobby 
                hostData={hostData}
                onGoLive={handleGoLive}
                isGoingLive={isGoingLive}
                orbState={orbState}
                inputVolume={inputVolume}
                outputVolume={outputVolume}
                onOrbClick={handleOrbClick}
                statusText={statusText}
            />
        );
    } else {
        // Non-host sees "Request to Start" button
        return (
            <RequestHostLobby 
                hostData={hostData}
                onRequestStart={handleRequestStart}
                requestSent={requestSent}
            />
        );
    }
};

// Export with DailyProvider wrapper
export default function HostSpacePage() {
    return (
        <DailyProvider>
            <HostSpaceContent />
        </DailyProvider>
    );
}
