"use client";

import { useAuth } from "@/components/providers";

interface ConnectXButtonProps {
    className?: string;
    text?: string;
}

export function ConnectXButton({ className, text = "Continue with X" }: ConnectXButtonProps) {
    const { login } = useAuth();
    
    return (
        <button
            onClick={login}
            className={className || "flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-sm font-medium text-white transition-all"}
        >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            {text}
        </button>
    );
}
