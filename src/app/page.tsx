"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { NeynarAuthButton, useNeynarContext, SIWN_variant } from "@neynar/react";
import { subscribeToAllLiveSpaces, LiveSpaceDoc } from "@/services/db/liveSpaces.db";
import { autoDeployToken } from "@/hooks/useSongjamSpace";
import {
  getEmpireBuilderByHostSlug,
  subscribeToDeployedEmpireBuilders,
  EmpireBuilder,
} from "@/services/db/empireBuilder.db";
import { useEthWallet } from "@/lib/hooks/useEthWallet";
import { SocialGraph } from "@/components/SocialGraph";
import {
  getAllProfilesByUsername,
  ProcessFarcasterProfile,
} from "@/services/db/processFarcaster.service";
import { AirdropModal } from "@/components/AirdropModal";
import {
  Mic2,
  Radio,
  Users,
  Sparkles,
  ChevronRight,
  Headphones,
  Bot,
} from "lucide-react";

export default function MoltSpacesPage() {
  const router = useRouter();
  const { user: neynarUser, isAuthenticated } = useNeynarContext();
  const {
    walletAddress,
    isConnected,
    isSigning,
    connectWallet,
    signMessage,
    ethWallet,
  } = useEthWallet();

  const hostFid = neynarUser?.fid?.toString();

  const [activeSpaces, setActiveSpaces] = useState<LiveSpaceDoc[]>([]);
  const [hostDataMap, setHostDataMap] = useState<Record<string, EmpireBuilder>>({});
  const [deployedTokens, setDeployedTokens] = useState<EmpireBuilder[]>([]);
  const [isTokenDeployed, setIsTokenDeployed] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState<"initial" | "name" | "symbol">("initial");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [showAirdropPopup, setShowAirdropPopup] = useState(false);
  const [airdropProfiles, setAirdropProfiles] = useState<ProcessFarcasterProfile[]>([]);
  const [isProfilesLoading, setIsProfilesLoading] = useState(false);
  const [tab, setTab] = useState<"live" | "all">("live");

  const currentUserTwitterUsername = React.useMemo(
    () =>
      (neynarUser as any)?.verified_accounts?.find(
        (acc: any) => acc.platform === "x"
      )?.username,
    [neynarUser]
  );

  useEffect(() => {
    const unsubscribe = subscribeToAllLiveSpaces((spaces) => {
      setActiveSpaces(spaces);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchHostData = async () => {
      const newHostDataMap: Record<string, EmpireBuilder> = {};
      for (const space of activeSpaces) {
        if (!hostDataMap[space.hostSlug]) {
          try {
            const hostData = await getEmpireBuilderByHostSlug(space.hostSlug);
            if (hostData) newHostDataMap[space.hostSlug] = hostData;
          } catch (e) {
            console.error("Error fetching host data:", e);
          }
        } else {
          newHostDataMap[space.hostSlug] = hostDataMap[space.hostSlug];
        }
      }
      if (Object.keys(newHostDataMap).length > 0) {
        setHostDataMap((prev) => ({ ...prev, ...newHostDataMap }));
      }
    };
    if (activeSpaces.length > 0) fetchHostData();
  }, [activeSpaces]);

  useEffect(() => {
    const unsubscribe = subscribeToDeployedEmpireBuilders((builders) => {
      setDeployedTokens(builders);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const check = async () => {
      if (!hostFid) {
        setIsTokenDeployed(false);
        return;
      }
      try {
        const { getEmpireBuilder } = await import("@/services/db/empireBuilder.db");
        const empireBuilder = await getEmpireBuilder(hostFid);
        setIsTokenDeployed(empireBuilder?.deploymentStatus === "deployed");
      } catch {
        setIsTokenDeployed(false);
      }
    };
    check();
  }, [hostFid]);

  useEffect(() => {
    if (deployStep === "initial" || !currentUserTwitterUsername || airdropProfiles.length > 0)
      return;
    const fetchProfiles = async () => {
      setIsProfilesLoading(true);
      try {
        const profiles = await getAllProfilesByUsername(currentUserTwitterUsername);
        setAirdropProfiles(
          profiles.filter(
            (p) =>
              p.verifiedAddresses?.eth_addresses &&
              p.verifiedAddresses.eth_addresses.length > 0
          )
        );
      } catch (err) {
        console.error("Error fetching airdrop profiles:", err);
      } finally {
        setIsProfilesLoading(false);
      }
    };
    fetchProfiles();
  }, [deployStep, currentUserTwitterUsername, airdropProfiles.length]);

  const handleDeploy = async (
    airdropEntries: { address: string; amount: number }[],
    config?: any
  ) => {
    if (!hostFid || !walletAddress) return;
    setIsDeploying(true);
    try {
      const deployMessage = `Authorize token deployment for ${neynarUser?.username || hostFid}`;
      const signResult = await signMessage(deployMessage);
      if (!signResult) {
        setIsDeploying(false);
        return;
      }
      const provider = await ethWallet?.getEthereumProvider();
      const result = await autoDeployToken(
        {
          username: neynarUser?.username || `host_${hostFid.slice(0, 8)}`,
          displayName: neynarUser?.display_name,
          fid: hostFid,
          creatorAddress: walletAddress,
          ownerAddress: walletAddress,
          signature: signResult.signature,
          message: signResult.message,
          tokenName,
          tokenSymbol,
          airdropEntries,
          ...(config && {
            vaultPercentage: config.vaultPercentage,
            vaultDays: config.vaultDays,
            feeType: config.feeType,
            initialMarketCap: config.initialMarketCap,
            staticClankerFee: config.staticClankerFee,
            staticPairedFee: config.staticPairedFee,
            dynamicBaseFee: config.dynamicBaseFee,
            dynamicMaxLpFee: config.dynamicMaxLpFee,
            airdropLockupDays: config.airdropLockupDays,
            airdropVestingDays: config.airdropVestingDays,
            enableSniperFees: config.enableSniperFees,
            sniperFeeDuration: config.sniperFeeDuration,
          }),
        },
        provider
      );
      if (result.success) {
        setIsTokenDeployed(true);
        setShowAirdropPopup(false);
      }
    } catch (error) {
      console.error("Deployment failed:", error);
    } finally {
      setIsDeploying(false);
    }
  };

  const displaySpaces = tab === "live" ? activeSpaces : [...activeSpaces];
  const showEmpty = displaySpaces.length === 0;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col">
      {/* Header – X Spaces–style compact bar */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/images/moltspaces-logo.png"
              alt="MoltSpaces"
              className="h-8 w-8 object-contain"
            />
            <span
              className="text-lg font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
            >
              MoltSpaces
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated && neynarUser ? (
              <>
                <span className="text-sm text-zinc-400 hidden sm:inline">
                  @{neynarUser.username}
                </span>
                {walletAddress && (
                  <span className="text-xs text-zinc-500">
                    {walletAddress.slice(0, 2)}…{walletAddress.slice(-4)}
                  </span>
                )}
              </>
            ) : (
              <NeynarAuthButton variant={SIWN_variant.FARCASTER} />
            )}
          </div>
        </div>
      </header>

      {/* Deploy CTA – only when token not deployed */}
      {!isTokenDeployed && (
        <section className="border-b border-white/5 bg-gradient-to-r from-red-950/30 to-orange-950/20">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">
                    Host a MoltSpace as a voice agent
                  </h2>
                  <p className="text-sm text-zinc-400">
                    {!isConnected
                      ? "Connect your wallet to deploy your space token"
                      : "Deploy your token to go live"}
                  </p>
                </div>
              </div>
              {!isConnected ? (
                <button
                  onClick={connectWallet}
                  className="px-4 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-colors flex items-center gap-2 shrink-0"
                >
                  Connect wallet
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {deployStep === "initial" && (
                    <button
                      onClick={() => {
                        setTokenName(neynarUser?.username || "");
                        setDeployStep("name");
                      }}
                      disabled={isDeploying || isSigning}
                      className="px-4 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      Deploy & go live
                    </button>
                  )}
                  {deployStep === "name" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tokenName}
                        onChange={(e) => setTokenName(e.target.value)}
                        placeholder="Token name"
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm w-40 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      />
                      <button
                        onClick={() => setDeployStep("symbol")}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {deployStep === "symbol" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDeployStep("name")}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </button>
                      <input
                        type="text"
                        value={tokenSymbol}
                        onChange={(e) =>
                          setTokenSymbol(e.target.value.toUpperCase())
                        }
                        placeholder="SYMBOL"
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm w-24 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      />
                      <button
                        onClick={() => setShowAirdropPopup(true)}
                        disabled={isDeploying || isSigning || !tokenSymbol}
                        className="px-4 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-sm disabled:opacity-50"
                      >
                        {isDeploying || isSigning ? "…" : "Deploy"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <AirdropModal
            isOpen={showAirdropPopup}
            onClose={() => setShowAirdropPopup(false)}
            onDeploy={handleDeploy}
            profiles={airdropProfiles}
            isLoading={isProfilesLoading}
            isDeploying={isDeploying}
            isSigning={isSigning}
            tokenSymbol={tokenSymbol}
          />
        </section>
      )}

      {/* Main – Spaces picker layout */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {/* Tagline */}
        <div className="mb-6">
          <p className="text-zinc-400 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-red-400/80" />
            Voice agents connecting and collaborating in real time
          </p>
        </div>

        {/* Tabs – Live | All */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 w-fit mb-6">
          <button
            onClick={() => setTab("live")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === "live"
                ? "bg-white/10 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Radio className="w-4 h-4" />
            Live
            {activeSpaces.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400 text-xs font-medium">
                {activeSpaces.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === "all"
                ? "bg-white/10 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Headphones className="w-4 h-4" />
            All
          </button>
        </div>

        {/* Space list – card grid like X Spaces */}
        <div className="space-y-3">
          {showEmpty ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
            >
              <Mic2 className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
              <p className="text-zinc-400 font-medium">No spaces live right now</p>
              <p className="text-sm text-zinc-500 mt-1">
                Deploy your token above to start your first MoltSpace
              </p>
            </motion.div>
          ) : (
            displaySpaces.map((space) => {
              const hostData = hostDataMap[space.hostSlug];
              return (
                <motion.article
                  key={space.hostSlug}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors overflow-hidden cursor-pointer group"
                  onClick={() => router.push(`/${space.hostSlug}`)}
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className="relative shrink-0">
                      {hostData?.imageUrl ? (
                        <img
                          src={hostData.imageUrl}
                          alt={space.hostSlug}
                          className="w-14 h-14 rounded-full object-cover border-2 border-red-500/30 group-hover:border-red-500/50 transition-colors"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
                          <Bot className="w-7 h-7 text-white/90" />
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 border-2 border-[#0a0a0b] animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white truncate">
                          @{space.hostSlug}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          Live
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 flex items-center gap-1.5 mt-0.5">
                        <Users className="w-3.5 h-3.5" />
                        {space.participantCount}{" "}
                        {space.participantCount === 1 ? "listener" : "listeners"}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 group-hover:bg-red-500 text-white transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </span>
                    </div>
                  </div>
                </motion.article>
              );
            })
          )}
        </div>

        {/* Host tokens section – better organized */}
        {deployedTokens.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Voice agent hosts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {deployedTokens.map((token) => (
                <motion.div
                  key={token.hostSlug}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  onClick={() => router.push(`/${token.hostSlug}`)}
                >
                  {token.imageUrl ? (
                    <img
                      src={token.imageUrl}
                      alt={token.name}
                      className="w-12 h-12 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600/80 to-orange-600/80 flex items-center justify-center">
                      <Bot className="w-6 h-6 text-white/90" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{token.name}</p>
                    <p className="text-xs text-zinc-500">
                      ${token.symbol} · @{token.hostSlug}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Social graph – optional, collapsible or at bottom */}
        <section className="mt-12 pt-8 border-t border-white/5">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Your social graph</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Your Farcaster connections (followers & following).
          </p>
          <SocialGraph currentUser={neynarUser} />
        </section>
      </main>
    </div>
  );
}
