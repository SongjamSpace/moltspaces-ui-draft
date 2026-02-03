"use client";

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';

interface Agent {
    id: string;
    name: string;
    description?: string;
    skill_name?: string;
    version?: string;
}

interface AgentsVisualizationProps {
    agents: Agent[];
    width: number;
    height: number;
    onNodeClick?: (node: any) => void;
}

const AgentsVisualization: React.FC<AgentsVisualizationProps> = ({ 
    agents, 
    width, 
    height,
    onNodeClick,
}) => {
    const fgRef = useRef<ForceGraphMethods>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);

    const graphData = useMemo(() => {
        const nodes = agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            description: agent.description || '',
            skill_name: agent.skill_name || '',
            version: agent.version || '',
        }));

        return { nodes, links: [] };
    }, [agents]);

    const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        // Guard against invalid coordinates
        if (!isFinite(node.x) || !isFinite(node.y)) return;
        
        const label = node.name;
        const fontSize = 12/globalScale;
        const radius = 8; 
        
        // Draw node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        
        // Gradient fill for premium look
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius);
        gradient.addColorStop(0, '#a855f7');
        gradient.addColorStop(1, '#7c3aed');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Border
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw label
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(label, node.x, node.y + radius + fontSize);
    }, []);

    const nodePointerAreaPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
        // Guard against invalid coordinates
        if (!isFinite(node.x) || !isFinite(node.y)) return;
        
        const radius = 8; 
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fill();
    }, []);

    useEffect(() => {
        if (fgRef.current) {
            fgRef.current.d3Force('charge')?.strength(-100);
            fgRef.current.d3Force('collide')?.radius(20);
        }
    }, [graphData]);

    const handleZoomIn = () => {
        if (fgRef.current) {
            fgRef.current.zoom(fgRef.current.zoom() * 1.5, 100);
        }
    };

    const handleZoomOut = () => {
        if (fgRef.current) {
            fgRef.current.zoom(fgRef.current.zoom() / 1.5, 100);
        }
    };

    return (
        <div ref={containerRef} className="relative w-full h-full">
            <ForceGraph2D
                ref={fgRef}
                width={width}
                height={height}
                graphData={graphData}
                nodeLabel={(node: any) => `${node.name}\n${node.skill_name ? `Skill: ${node.skill_name}` : ''}\n${node.description || ''}`}
                nodeCanvasObject={nodeCanvasObject}
                nodePointerAreaPaint={nodePointerAreaPaint}
                onNodeClick={onNodeClick}
                backgroundColor="rgba(0,0,0,0)"
                minZoom={0.5}
                maxZoom={6}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                cooldownTicks={100}
            />

            <div className="absolute bottom-4 left-4 pointer-events-none select-none z-0">
                <h1 className="text-4xl font-black text-white/15 tracking-tighter uppercase leading-none">MoltNet</h1>
                <p className="text-xs font-mono text-white/20 tracking-[0.2em] uppercase pl-1">Agent Network</p>
            </div>

            {graphData.nodes.length > 0 && <div className="absolute bottom-4 right-4 flex flex-col items-center gap-2 z-50">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1">Zoom</span>
                <div className="flex flex-col bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-700/50 overflow-hidden shadow-lg">
                    <button 
                        onClick={handleZoomIn}
                        className="p-2 hover:bg-slate-700/50 text-white transition-colors border-b border-slate-700/50 active:bg-slate-600"
                        aria-label="Zoom In"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </button>
                    <button 
                        onClick={handleZoomOut}
                        className="p-2 hover:bg-slate-700/50 text-white transition-colors active:bg-slate-600"
                        aria-label="Zoom Out"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                    </button>
                </div>
            </div>}
        </div>
    );
};

export default AgentsVisualization;
