"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useParticipantIds, useDaily } from '@daily-co/daily-react';
import { SpaceParticipant } from '@/services/db/liveSpaces.db';
import Image from 'next/image';

export interface HostProfile {
    username: string;
    displayName: string;
    pfpUrl?: string;
}

interface SpaceGraphDOMProps {
    hostProfile: HostProfile;
    activeSessions: SpaceParticipant[];
}

interface NodeData {
    id: string;
    type: 'root' | 'participant';
    username: string;
    displayName: string;
    pfpUrl?: string;
    isHost: boolean;
    status?: 'live' | 'offline';
}

const SpaceGraphDOM: React.FC<SpaceGraphDOMProps> = ({ 
    hostProfile,
    activeSessions
}) => {
    const daily = useDaily();
    const participantIds = useParticipantIds();
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    // Prepare graph data - Use Firebase activeSessions as primary source
    // Daily's userData is NOT shared with other participants, so we must rely on Firebase
    const { rootNode, participantNodes } = useMemo(() => {
        // Root Host Node - always show the host
        const root: NodeData = {
            id: 'root-host',
            type: 'root',
            username: hostProfile.username,
            displayName: hostProfile.displayName,
            pfpUrl: hostProfile.pfpUrl,
            isHost: true,
            status: 'offline'
        };

        const nodes: NodeData[] = [];

        // Check if host is live by looking in activeSessions
        const hostSession = activeSessions.find(
            s => s.role === 'host' || s.farcasterUsername === hostProfile.username
        );
        if (hostSession) {
            root.status = 'live';
            // Update host info from session if available
            if (hostSession.displayName) root.displayName = hostSession.displayName;
            if (hostSession.pfpUrl) root.pfpUrl = hostSession.pfpUrl;
        }

        // Build participant nodes from Firebase activeSessions (not Daily)
        // This ensures we show all participants with their proper profile info
        activeSessions.forEach((session) => {
            // Skip the host - they're shown as the root node
            if (session.role === 'host' || session.farcasterUsername === hostProfile.username) {
                return;
            }

            nodes.push({
                id: session.id || session.userFid,
                type: 'participant',
                username: session.farcasterUsername,
                displayName: session.displayName || session.farcasterUsername,
                pfpUrl: session.pfpUrl,
                isHost: false
            });
        });

        return { rootNode: root, participantNodes: nodes };
    }, [hostProfile, activeSessions]);

    // Calculate positions for participants in a circle around the host
    const getParticipantPosition = (index: number, total: number) => {
        const radius = Math.min(140, 80 + total * 15); // Dynamic radius based on count
        const angleOffset = -Math.PI / 2; // Start from top
        const angle = angleOffset + (2 * Math.PI * index) / Math.max(total, 1);
        
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        };
    };

    if (!rootNode) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-slate-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative overflow-hidden bg-transparent">
            {/* Connection lines (SVG layer behind nodes) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <g transform={`translate(50%, 50%)`} style={{ transform: 'translate(50%, 50%)' }}>
                    {participantNodes.map((node, index) => {
                        const pos = getParticipantPosition(index, participantNodes.length);
                        return (
                            <line
                                key={`line-${node.id}`}
                                x1="0"
                                y1="0"
                                x2={pos.x}
                                y2={pos.y}
                                stroke="rgba(148, 163, 184, 0.2)"
                                strokeWidth="1"
                                className="transition-all duration-500"
                                style={{
                                    opacity: hoveredNode === node.id ? 0.5 : 0.2
                                }}
                            />
                        );
                    })}
                </g>
            </svg>

            {/* Nodes container */}
            <div className="absolute inset-0 flex items-center justify-center">
                {/* Participant nodes */}
                {participantNodes.map((node, index) => {
                    const pos = getParticipantPosition(index, participantNodes.length);
                    return (
                        <div
                            key={node.id}
                            className="absolute flex flex-col items-center gap-1 cursor-pointer transition-transform duration-500 ease-out"
                            style={{
                                transform: `translate(${pos.x}px, ${pos.y}px) scale(${hoveredNode === node.id ? 1.1 : 1})`,
                                animationDelay: `${index * 100}ms`
                            }}
                            onMouseEnter={() => setHoveredNode(node.id)}
                            onMouseLeave={() => setHoveredNode(null)}
                        >
                            {/* Avatar */}
                            <div 
                                className="relative w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-600 overflow-hidden transition-all duration-300 animate-fade-in-scale"
                                style={{
                                    boxShadow: hoveredNode === node.id 
                                        ? '0 0 20px rgba(147, 51, 234, 0.4)' 
                                        : '0 4px 12px rgba(0, 0, 0, 0.3)'
                                }}
                            >
                                {node.pfpUrl ? (
                                    <Image
                                        src={node.pfpUrl}
                                        alt={node.displayName}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-medium">
                                        {node.displayName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            
                            {/* Label */}
                            <div className="px-2 py-0.5 bg-black/60 rounded text-white/90 text-xs whitespace-nowrap backdrop-blur-sm animate-fade-in">
                                {node.displayName}
                            </div>
                        </div>
                    );
                })}

                {/* Host node (center) */}
                <div
                    className="absolute flex flex-col items-center gap-1.5 cursor-pointer z-10"
                    onMouseEnter={() => setHoveredNode('root-host')}
                    onMouseLeave={() => setHoveredNode(null)}
                >
                    {/* Pulse ring animation for live host */}
                    {rootNode.status === 'live' && (
                        <>
                            <div className="absolute w-14 h-14 rounded-full bg-green-500/20 animate-ping" />
                            <div className="absolute w-16 h-16 rounded-full bg-green-500/10 animate-pulse" />
                        </>
                    )}
                    
                    {/* Avatar */}
                    <div 
                        className={`
                            relative w-12 h-12 rounded-full overflow-hidden transition-all duration-300
                            ${rootNode.status === 'live' 
                                ? 'border-2 border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.4)]' 
                                : 'border-2 border-purple-400 shadow-[0_0_20px_rgba(192,132,252,0.3)]'
                            }
                        `}
                        style={{
                            background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                            transform: hoveredNode === 'root-host' ? 'scale(1.1)' : 'scale(1)'
                        }}
                    >
                        {rootNode.pfpUrl ? (
                            <Image
                                src={rootNode.pfpUrl}
                                alt={rootNode.displayName}
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-lg font-semibold">
                                {rootNode.displayName.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    
                    {/* Host label */}
                    <div className="flex flex-col items-center gap-0.5">
                        <div className="px-2 py-0.5 bg-black/60 rounded text-white/90 text-sm font-medium whitespace-nowrap backdrop-blur-sm">
                            {rootNode.displayName}
                        </div>
                        <span className="text-[10px] text-purple-400 font-medium uppercase tracking-wider">
                            Host
                        </span>
                    </div>
                </div>
            </div>

            {/* CSS Animations */}
            <style jsx>{`
                @keyframes fade-in-scale {
                    0% {
                        opacity: 0;
                        transform: scale(0.5);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                
                @keyframes fade-in {
                    0% {
                        opacity: 0;
                    }
                    100% {
                        opacity: 1;
                    }
                }
                
                .animate-fade-in-scale {
                    animation: fade-in-scale 0.4s ease-out forwards;
                }
                
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default SpaceGraphDOM;
