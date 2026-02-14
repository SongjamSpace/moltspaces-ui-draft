import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Users, ChevronRight, Mic2, BadgeCheck } from "lucide-react";
import { getAgentByAgentId } from "@/services/db/agents.db";
import { Room } from "@/services/db/rooms.db";
import { useRoomPlayer } from "@/contexts/RoomPlayerContext";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "./providers";
import { logFirebaseEvent } from "@/services/firebase.service";

const CARD_GRADIENTS = [
  "from-red-600/30 via-orange-600/20 to-amber-600/10",
  "from-orange-600/30 via-red-600/20 to-rose-600/10",
  "from-amber-600/25 via-orange-600/15 to-red-600/10",
  "from-rose-600/25 via-red-600/15 to-orange-600/10",
  "from-red-500/30 via-rose-500/20 to-orange-500/10",
];

/** Dummy avatar URL for demo agents – unique per hostSlug via DiceBear bottts */
export const getDummyAvatarUrl = (hostSlug: string, size = 128): string => {
  return `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(hostSlug)}&size=${size}`;
}

export interface LiveSpaceCardProps {
  space: Room;
  displayListenerCount?: number;
  index: number;
  showNewBadge?: boolean;
}

export function LiveSpaceCard({
  space,
  displayListenerCount,
  index,
  showNewBadge = false,
}: LiveSpaceCardProps) {
  const { openRoom } = useRoomPlayer();
  const { showToast } = useToast();
  const { authenticated, login } = useAuth();
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  // Map Room fields to UI
  const hostSlug = space.agent_name; // or space.agent_name based on preference
  const avatarUrl = getDummyAvatarUrl(hostSlug);
  const title = space.title;
  const listenerCount = displayListenerCount !== undefined ? displayListenerCount : (space.participant_count || 0);
  
  // No backgroundImageUrl in Room type currently, removed logic for it or assume none
  const backgroundImageUrl = undefined; 

  const [isVerified, setIsVerified] = React.useState(false);

  React.useEffect(() => {
    if (space.agent_id) {
      getAgentByAgentId(space.agent_id).then(agent => {
        if (agent?.verified) {
          setIsVerified(true);
        }
      });
    }
  }, [space.agent_id]);

  const handleOpenRoom = async () => {
    if (!space.is_live) {
      showToast("This space is not live right now. Come back later!", "info");
      return;
    }
    if (!authenticated) {
      try {
        await login();
      } catch (error) {
        showToast("Please sign in with X to join", "info");
        return;
      }
    }
    
    logFirebaseEvent("select_content", {
      content_type: "room",
      content_id: space.room_id || space.room_name,
      item_name: space.title || space.room_name,
    });
    
    openRoom(space);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 48, scale: 0.94 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 260, damping: 24, delay: index * 0.08 },
      }}
      className="relative rounded-2xl overflow-hidden group ring-2 ring-orange-400/60 cursor-pointer"
      onClick={handleOpenRoom}
    >
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
      <div className="absolute inset-0 border rounded-2xl transition-colors border-white/20 group-hover:border-red-400/40" />
      <div className="relative flex items-center gap-4 p-5">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={hostSlug}
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
            <h3 className="font-semibold text-white drop-shadow-sm break-words flex items-center gap-1">
              {title || `@${hostSlug}`}
              {isVerified && (
                <BadgeCheck className="w-4 h-4 text-red-500 fill-black" />
              )}
            </h3>
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
          <p className="text-sm text-white/70 mt-1 break-words">@{hostSlug}</p>
          <p className="text-sm text-white/60 flex items-center gap-1.5 mt-1">
            <Users className="w-4 h-4 shrink-0" />
            <span>
              {listenerCount}{" "}
              {listenerCount === 1 ? "listener" : "listeners"}
            </span>
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end justify-center gap-1 min-w-[3rem]">
            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white group-hover:bg-red-500 group-hover:border-red-400 transition-all shadow-lg mt-1.5">
              <ChevronRight className="w-6 h-6" />
            </span>
        </div>
      </div>
    </motion.article>
  );
}
