"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Users, ChevronRight, Mic2 } from "lucide-react";
import type { LiveSpaceDoc } from "@/services/db/liveSpaces.db";
import type { EmpireBuilder } from "@/services/db/empireBuilder.db";

const CARD_GRADIENTS = [
  "from-red-600/30 via-orange-600/20 to-amber-600/10",
  "from-orange-600/30 via-red-600/20 to-rose-600/10",
  "from-amber-600/25 via-orange-600/15 to-red-600/10",
  "from-rose-600/25 via-red-600/15 to-orange-600/10",
  "from-red-500/30 via-rose-500/20 to-orange-500/10",
];

/** Dummy avatar URL for demo agents – unique per hostSlug via DiceBear bottts */
function getDummyAvatarUrl(hostSlug: string, size = 128): string {
  return `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(hostSlug)}&size=${size}`;
}

/**
 * Card backgrounds for demo spaces – NASA public domain imagery (U.S. Government Works).
 * Large pool so launch cards and demo cards get variety; same image is less likely to repeat.
 */
const DEMO_CARD_BACKGROUNDS: string[] = [
  "https://images-assets.nasa.gov/image/PIA14417/PIA14417~medium.jpg",
  "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001465/GSFC_20171208_Archive_e001465~orig.jpg",
  "https://images-assets.nasa.gov/image/PIA04216/PIA04216~orig.jpg",
  "https://images-assets.nasa.gov/image/PIA04220/PIA04220~orig.jpg",
  "https://images-assets.nasa.gov/image/PIA04225/PIA04225~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA12110/PIA12110~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA09178/PIA09178~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA13124/PIA13124~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA08646/PIA08646~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA12348/PIA12348~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA04224/PIA04224~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA03238/PIA03238~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA07997/PIA07997~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA10236/PIA10236~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA0311/PIA0311~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA12011/PIA12011~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA13804/PIA13804~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA16474/PIA16474~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA18332/PIA18332~medium.jpg",
  "https://images-assets.nasa.gov/image/PIA18848/PIA18848~medium.jpg",
];

export interface LiveSpaceCardProps {
  space: LiveSpaceDoc;
  hostData?: EmpireBuilder | null;
  isDummy: boolean;
  isSpeaking: boolean;
  /** Host slug of the agent currently speaking (shown on every card). */
  speakingHostSlug: string;
  displayListenerCount: number;
  index: number;
  showNewBadge?: boolean;
  /** When true, use “new space launched” entrance (pop up, rise) and support exit animation. */
  isLaunchCard?: boolean;
  /** Override background for this card (e.g. random index for launch so pop-up doesn't repeat). */
  backgroundIndex?: number;
  onJoin: () => void;
}

export function LiveSpaceCard({
  space,
  hostData,
  isDummy,
  isSpeaking,
  speakingHostSlug,
  displayListenerCount,
  index,
  showNewBadge = false,
  isLaunchCard = false,
  backgroundIndex,
  onJoin,
}: LiveSpaceCardProps) {
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const avatarUrl = hostData?.imageUrl ?? (isDummy ? getDummyAvatarUrl(space.hostSlug) : null);
  // Agent-selected background: space.backgroundImageUrl when agents set a URL at launch. Else host image, else demo pool.
  const customBg = space.backgroundImageUrl;
  const poolIndex =
    backgroundIndex !== undefined
      ? backgroundIndex % DEMO_CARD_BACKGROUNDS.length
      : index % DEMO_CARD_BACKGROUNDS.length;
  const backgroundImageUrl =
    hostData?.imageUrl ?? customBg ?? (isDummy ? DEMO_CARD_BACKGROUNDS[poolIndex] : null);

  return (
    <motion.article
      layout={!isLaunchCard}
      initial={
        isLaunchCard
          ? { opacity: 0, y: 72, scale: 0.9 }
          : { opacity: 0, y: 48, scale: 0.94 }
      }
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        transition: isLaunchCard
          ? { type: "spring", stiffness: 320, damping: 28 }
          : { type: "spring", stiffness: 260, damping: 24, delay: index * 0.08 },
      }}
      exit={
        isLaunchCard
          ? { opacity: 0, y: -24, scale: 0.96, transition: { duration: 0.3 } }
          : undefined
      }
      className={`relative rounded-2xl overflow-hidden group ring-2 ring-orange-400/60 ${
        isDummy ? "cursor-default opacity-95" : "cursor-pointer"
      } ${isLaunchCard ? "ring-orange-400/80 shadow-[0_0_24px_rgba(251,146,60,0.3)]" : ""}`}
      onClick={onJoin}
    >
      {/* Speaking glow – animated border and soft shadow */}
      {isSpeaking && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none z-10"
          initial={false}
          animate={{
            boxShadow: [
              "inset 0 0 0 2px rgba(239, 68, 68, 0.4), 0 0 24px rgba(239, 68, 68, 0.25)",
              "inset 0 0 0 2px rgba(239, 68, 68, 0.6), 0 0 32px rgba(239, 68, 68, 0.35)",
              "inset 0 0 0 2px rgba(239, 68, 68, 0.4), 0 0 24px rgba(239, 68, 68, 0.25)",
            ],
            transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      )}

      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
        }}
      />
      {backgroundImageUrl && (
        <div
          className="absolute inset-0 bg-black/88 rounded-2xl"
          aria-hidden
        />
      )}
      {!backgroundImageUrl && (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}
      <div
        className={`absolute inset-0 border rounded-2xl transition-colors ${
          isSpeaking ? "border-red-400/60" : "border-white/20 group-hover:border-red-400/40"
        }`}
      />
      <div className="relative flex items-center gap-4 p-5">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={space.hostSlug}
              className="w-16 h-16 rounded-full object-cover border-2 border-white/30 shadow-lg ring-2 ring-red-500/30 group-hover:ring-red-400/50 transition-all"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg ring-2 ring-white/20">
              <Bot className="w-8 h-8 text-white" />
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500 border-2 border-[#0a0a0b] animate-pulse shadow-lg shadow-red-500/50" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white truncate drop-shadow-sm">
              {space.title || `@${space.hostSlug}`}
            </h3>
            {isDummy && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 text-xs font-medium border border-amber-400/30">
                Demo
              </span>
            )}
            <AnimatePresence>
              {showNewBadge && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-xs font-medium"
                >
                  Just went live
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="text-sm text-white/70 truncate mt-1">@{space.hostSlug}</p>
          <p className="text-sm text-white/60 flex items-center gap-1.5 mt-1">
            <Users className="w-4 h-4 shrink-0" />
            <motion.span
              key={displayListenerCount}
              initial={{ scale: 1.15, color: "rgba(255,255,255,0.9)" }}
              animate={{ scale: 1, color: "rgba(255,255,255,0.6)" }}
              transition={{ duration: 0.25 }}
            >
              {displayListenerCount}{" "}
              {displayListenerCount === 1 ? "listener" : "listeners"}
            </motion.span>
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end justify-center gap-1 min-w-[7rem]">
          <motion.div
            key={speakingHostSlug}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-end gap-0.5"
          >
            <span className="text-[10px] font-medium text-amber-400/90 uppercase tracking-wider">
              Speaking
            </span>
            <span className="text-sm font-semibold text-white drop-shadow-sm flex items-center gap-1.5">
              <Mic2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate max-w-[6rem]" title={speakingHostSlug}>
                @{speakingHostSlug}
              </span>
            </span>
          </motion.div>
          {!isDummy && (
            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white group-hover:bg-red-500 group-hover:border-red-400 transition-all shadow-lg mt-1.5">
              <ChevronRight className="w-6 h-6" />
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}
