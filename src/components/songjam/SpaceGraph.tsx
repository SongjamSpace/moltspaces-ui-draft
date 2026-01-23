"use client";

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ForceGraphMethods } from 'react-force-graph-2d';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false
});
import { useParticipantIds, useDaily } from '@daily-co/daily-react';
import { SpaceParticipant } from '@/services/db/liveSpaces.db';

export interface HostProfile {
    username: string; // farcaster handle
    displayName: string;
    pfpUrl?: string;
}

interface SpaceGraphProps {
    hostProfile: HostProfile;
    activeSessions: SpaceParticipant[];
}

const SpaceGraph: React.FC<SpaceGraphProps> = ({ 
    hostProfile,
    activeSessions
}) => {
    const fgRef = useRef<ForceGraphMethods>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const daily = useDaily();
    const participantIds = useParticipantIds();

    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        window.addEventListener('resize', updateDimensions);
        updateDimensions();

        return () => window.removeEventListener('resize', updateDimensions);
    }, []);
    
    // Cache images
    const imagesCache = useMemo(() => new Map<string, HTMLImageElement>(), []);

    // Prepare graph data
    const graphData = useMemo(() => {
        if (!daily) return { nodes: [], links: [] };

        const participants = daily.participants();
        const nodes: any[] = [];
        const links: any[] = [];

        // 1. Create the Root Host Node (Base State)
        // We start with the DB data, but will override with live data if the host is in the call
        const rootNode = {
            id: 'root-host',
            type: 'root',
            username: hostProfile.username,
            displayName: hostProfile.displayName,
            pfpUrl: hostProfile.pfpUrl,
            isHost: true,
            status: 'offline', // default
            fx: 0, 
            fy: 0
        };

        const participantNodes: any[] = [];

        participantIds.forEach((id) => {
            const p = participants[id];
            if (!p) return;

            // @ts-ignore - Daily userData typing
            const userData = p.userData as any;
            
            // Check if this participant is the host
            // 1. Explicit flag from join (most reliable)
            // 2. Username match
            // 3. FID match (if available in both places)
            const isThisUserHost = 
                userData?.isHost === true || 
                userData?.farcasterUsername === hostProfile.username;
                // (userData?.fid && hostData.fid && String(userData.fid) === String(hostData.fid));

            if (isThisUserHost) {
                // Allows us to show their live status/PFP if changed
                rootNode.status = 'live';
                if (userData?.displayName) rootNode.displayName = userData.displayName;
                if (userData?.pfpUrl) rootNode.pfpUrl = userData.pfpUrl;
                // Host is represented by the root node, so we don't add a separate node
                return;
            }

            // Regular Participant
            const name = userData?.displayName || userData?.userName || p.user_name || 'Guest';
            // Only show 'Guest' if we really have no identifier. 
            // If we have a username but no display name, use username.
            let label = name !== 'Guest' ? name : (userData?.farcasterUsername || 'Guest');
            let username = userData?.farcasterUsername || label;
            let pfpUrl = userData?.pfpUrl;

            // --- PFP & Name Fallback using Active Sessions ---
            // If we don't have good data from Daily, check our active sessions DB
            if (!pfpUrl || label === 'Guest') {
                // Try to find a matching session
                // We don't have a perfect link unless we used dailySessionId, but we can fuzzy match?
                // Or if we passed fid in userData, use that.
                
                // If the user joined with our new logic, userData SHOULD have fid.
                const userFid = userData?.fid;
                
                if (userFid) {
                    const session = activeSessions.find(s => s.userFid === String(userFid));
                    if (session) {
                        if (!pfpUrl) pfpUrl = session.pfpUrl;
                        if (label === 'Guest' || !userData?.displayName) label = session.displayName;
                        username = session.farcasterUsername;
                    }
                } else if (label !== 'Guest') {
                    // Fallback: Try to match by display name or username
                    const session = activeSessions.find(s => s.displayName === label || s.farcasterUsername === label);
                     if (session) {
                        if (!pfpUrl) pfpUrl = session.pfpUrl;
                        username = session.farcasterUsername;
                    }
                } 
                // If we don't have FID in userData (e.g. old client/bug), tough luck, 
                // but maybe we can match by username if available?
            }
            // ------------------------------------------------

            participantNodes.push({
                id: id,
                type: 'participant',
                username: username,
                displayName: label,
                pfpUrl: pfpUrl, 
                isHost: false
            });
        });

        // Add Root Node first
        nodes.push(rootNode);
        
        // Add Participants and Links
        participantNodes.forEach(node => {
            nodes.push(node);
            links.push({
                source: node.id,
                target: 'root-host',
                distance: 50
            });
        });

        return { nodes, links };
    }, [daily, participantIds, hostProfile, activeSessions]);

    const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        // Draw sizes
        const radius = node.type === 'root' ? 24 : 16; // Slightly larger nodes
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = node.type === 'root' ? '#9333ea' : '#0f172a'; // Purple for host
        ctx.fill();
        
        // Border
        ctx.lineWidth = 2 / globalScale;
        // Host gets a special border if "live" (matched with participant)
        if (node.type === 'root' && node.status === 'live') {
            ctx.strokeStyle = '#4ade80'; // Green for live host
        } else {
            ctx.strokeStyle = node.type === 'root' ? '#c084fc' : '#475569';
        }
        ctx.stroke();

        // Draw image if available
        if (node.pfpUrl) {
            let img = imagesCache.get(node.pfpUrl);
            if (!img) {
                img = new Image();
                img.src = node.pfpUrl;
                img.crossOrigin = "Anonymous";
                imagesCache.set(node.pfpUrl, img);
            }

            if (img.complete && img.naturalHeight !== 0) {
                 ctx.save();
                 ctx.beginPath();
                 ctx.arc(node.x, node.y, radius, 0, Math.PI * 2, true);
                 ctx.closePath();
                 ctx.clip();
                 try {
                    ctx.drawImage(img, node.x - radius, node.y - radius, radius * 2, radius * 2);
                 } catch(e) {
                     // ignore
                 }
                 ctx.restore();
            }
        }
        
        // Label
        const label = node.displayName || node.username;
        if (label) {
            const fontSize = 12 / globalScale; // Increased from 8
            ctx.font = `${fontSize}px Sans-Serif`;
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4); // some padding

            // Background for text
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();
            // Rounded rectangle background
            const bgX = node.x - bckgDimensions[0] / 2;
            const bgY = node.y + radius + (4 / globalScale);
            const bgW = bckgDimensions[0];
            const bgH = bckgDimensions[1];
            const r = 4 / globalScale; // border radius

            ctx.roundRect(bgX, bgY, bgW, bgH, r);
            ctx.fill();

            // Text
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillText(label, node.x, bgY + bgH / 2);
        }
    }, [imagesCache]);

    useEffect(() => {
        // Force settings
        if (fgRef.current) {
            fgRef.current.d3Force('charge')?.strength(-100);
            fgRef.current.d3Force('details')?.strength(0.1); 
        }
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full">
            <ForceGraph2D
                ref={fgRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                nodeCanvasObject={nodeCanvasObject}
                backgroundColor="rgba(0,0,0,0)"
                minZoom={0.5}
                maxZoom={4}
                enableZoomInteraction={true} // Maybe disable for cleaner look?
                enablePanInteraction={true}
                
                // Links
                linkColor={() => "rgba(148, 163, 184, 0.2)"} // slate-400/20
                linkWidth={1}
            />
        </div>
    );
};

export default SpaceGraph;
