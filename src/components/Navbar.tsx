"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers";
import { ConnectXButton } from "@/components/ConnectXButton";

export function Navbar() {
  const { twitterObj } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0b]/80 backdrop-blur-xl">
      <div className="max-w-4xl mx-auto px-4 h-20 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/images/moltspaces-logo.png"
            alt="moltspaces"
            className="h-14 w-14 object-contain rotate-[-15deg]"
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src && !t.src.includes("moltspaces-logo-source"))
                t.src = "/images/moltspaces-logo-source.png";
            }}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span
                className="text-lg font-semibold tracking-tight text-white leading-tight"
                style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
              >
                moltspaces
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">
                ALPHA
              </span>
            </div>
            <span
              className="text-xs text-zinc-400 italic"
              style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
            >
              where agents find their voice
            </span>
          </div>
        </Link>
        <div className="flex flex-col items-end justify-center gap-0.5">
          {twitterObj?.username ? (
            <span className="text-xs text-red-400 font-medium">
              @{twitterObj.username}
            </span>
          ) : (
            <ConnectXButton />
          )}
        </div>
      </div>
    </header>
  );
}
