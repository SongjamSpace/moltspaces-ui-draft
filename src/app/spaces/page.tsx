"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { NeynarAuthButton, useNeynarContext, SIWN_variant } from "@neynar/react";
import { subscribeToAllLiveSpaces, LiveSpaceDoc } from "@/services/db/liveSpaces.db";
import { autoDeployToken } from "@/hooks/useSongjamSpace";
import { getEmpireBuilder, getEmpireBuilderByHostSlug, subscribeToDeployedEmpireBuilders, EmpireBuilder } from "@/services/db/empireBuilder.db";
import { useEthWallet } from "@/lib/hooks/useEthWallet";
import { SocialGraph } from "@/components/SocialGraph";
import { getAllProfilesByUsername, ProcessFarcasterProfile } from "@/services/db/processFarcaster.service";


export default function SpacesPage() {
  const router = useRouter();
  const { user: neynarUser, isAuthenticated } = useNeynarContext();
  const { walletAddress, isConnected, isSigning, connectWallet, signMessage } = useEthWallet();

  // Get the host's fid for token check
  const hostFid = neynarUser?.fid?.toString();

  const [activeSpaces, setActiveSpaces] = useState<LiveSpaceDoc[]>([]);
  const [hostDataMap, setHostDataMap] = useState<Record<string, EmpireBuilder>>({});
  const [deployedTokens, setDeployedTokens] = useState<EmpireBuilder[]>([]);
  const [isTokenDeployed, setIsTokenDeployed] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState<'initial' | 'name' | 'symbol'>('initial');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [showAirdropPopup, setShowAirdropPopup] = useState(false);
  const [airdropProfiles, setAirdropProfiles] = useState<ProcessFarcasterProfile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [isProfilesLoading, setIsProfilesLoading] = useState(false);

  const currentUserTwitterUsername = React.useMemo(() => 
    (neynarUser as any)?.verified_accounts?.find((acc: any) => acc.platform === 'x')?.username,
    [neynarUser]
  );

  // Subscribe to all live spaces
  useEffect(() => {
    const unsubscribe = subscribeToAllLiveSpaces((spaces) => {
      setActiveSpaces(spaces);
    });
    return unsubscribe;
  }, []);

  // Fetch host data for live spaces (for avatars)
  useEffect(() => {
    const fetchHostData = async () => {
      const newHostDataMap: Record<string, EmpireBuilder> = {};
      for (const space of activeSpaces) {
        if (!hostDataMap[space.hostSlug]) {
          try {
            const hostData = await getEmpireBuilderByHostSlug(space.hostSlug);
            if (hostData) {
              newHostDataMap[space.hostSlug] = hostData;
            }
          } catch (error) {
            console.error('Error fetching host data:', error);
          }
        } else {
          newHostDataMap[space.hostSlug] = hostDataMap[space.hostSlug];
        }
      }
      if (Object.keys(newHostDataMap).length > 0) {
        setHostDataMap(prev => ({ ...prev, ...newHostDataMap }));
      }
    };
    if (activeSpaces.length > 0) {
      fetchHostData();
    }
  }, [activeSpaces]);

  // Subscribe to all deployed empire builders
  useEffect(() => {
    const unsubscribe = subscribeToDeployedEmpireBuilders((builders) => {
      setDeployedTokens(builders);
    });
    return unsubscribe;
  }, []);

  // Check if token is already deployed
  useEffect(() => {
    const checkTokenDeployment = async () => {
      if (!hostFid) {
        setIsTokenDeployed(false);
        return;
      }
      try {
        const empireBuilder = await getEmpireBuilder(hostFid);
        setIsTokenDeployed(empireBuilder?.deploymentStatus === 'deployed');
      } catch (error) {
        console.error('Error checking token deployment:', error);
        setIsTokenDeployed(false);
      }
    };
    checkTokenDeployment();
  }, [hostFid]);

  // Fetch profiles for airdrop when entering deployment flow
  useEffect(() => {
    if (deployStep === 'initial' || !currentUserTwitterUsername) return;
    if (airdropProfiles.length > 0) return; // Don't refetch if already loaded
    
    const fetchProfiles = async () => {
      setIsProfilesLoading(true);
      try {
        const profiles = await getAllProfilesByUsername(currentUserTwitterUsername);
        // Filter profiles that have an ETH address
        const validProfiles = profiles.filter(p => 
          p.verified_addresses?.eth_addresses && p.verified_addresses.eth_addresses.length > 0
        );
        setAirdropProfiles(validProfiles);
        // Select all by default
        setSelectedProfiles(new Set(validProfiles.map(p => p.farcasterId)));
      } catch (err) {
        console.error("Error fetching airdrop profiles:", err);
      } finally {
        setIsProfilesLoading(false);
      }
    };

    fetchProfiles();
  }, [deployStep, currentUserTwitterUsername, airdropProfiles.length]);

  const toggleProfileSelection = (farcasterId: string) => {
    const newSelected = new Set(selectedProfiles);
    if (newSelected.has(farcasterId)) {
      newSelected.delete(farcasterId);
    } else {
      newSelected.add(farcasterId);
    }
    setSelectedProfiles(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedProfiles.size === airdropProfiles.length) {
      setSelectedProfiles(new Set());
    } else {
      setSelectedProfiles(new Set(airdropProfiles.map(p => p.farcasterId)));
    }
  };

  const handleDeploy = async () => {
    if (!hostFid || !walletAddress) return;
    setIsDeploying(true);
    try {
      // Sign message before deployment
      const deployMessage = `Authorize token deployment for ${neynarUser?.username || hostFid}`;
      const signResult = await signMessage(deployMessage);
      
      if (!signResult) {
        console.error('Signing cancelled or failed');
        setIsDeploying(false);
        return;
      }

      const result = await autoDeployToken({
        twitterId: hostFid,
        username: neynarUser?.username || `host_${hostFid.slice(0, 8)}`,
        displayName: neynarUser?.display_name || undefined,
        fid: neynarUser?.fid?.toString(),
        creatorAddress: walletAddress,
        ownerAddress: walletAddress,
        signature: signResult.signature,
        message: signResult.message,
        tokenName: tokenName,
        tokenSymbol: tokenSymbol,
      });
      if (result.success) {
        setIsTokenDeployed(true);
        setShowAirdropPopup(false);
      }
    } catch (error) {
      console.error('Deployment failed:', error);
    } finally {
      setIsDeploying(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-950 flex flex-col max-w-[1200px] mx-auto">
      <header className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <img src="/images/logo1.png" alt="Logo" className="h-8 w-8" />
              <span
                className="text-xl font-black text-white"
                style={{
                  fontFamily: "Audiowide, cursive",
                  textShadow: "0 0 20px rgba(255, 255, 255, 0.4), 0 0 40px rgba(255, 255, 255, 0.2)",
                  letterSpacing: "0.1em",
                  fontWeight: 400,
                }}
              >
                SONGJAM
              </span>
            </div>
          </div>
          
          {isAuthenticated && neynarUser ? (
            <div className="flex flex-col items-end">
              <span className="px-3 py-1.5 text-sm font-medium bg-slate-800/80 text-cyan-400 rounded-full border border-slate-700/50">
                @{neynarUser.username}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                {walletAddress 
                  ? `${walletAddress.slice(0, 2)}...${walletAddress.slice(-4)}`
                  : 'wallet not connected'}
              </span>
            </div>
          ) : (
            <NeynarAuthButton variant={SIWN_variant.FARCASTER} />
          )}
        </div>
      </header>

      {/* Deploy Empire Builder Token Section - Only show if not deployed */}
      {isTokenDeployed === false && (
      <section className="px-6 mb-6">
        <div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/40 to-cyan-900/40 border border-purple-500/30 hover:border-purple-500/50 transition-all">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="w-full md:w-auto">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🚀</span>
                <h2 className="text-lg font-semibold text-white">Empire Builder Token</h2>
              </div>
              <p className="text-sm text-slate-400">
                {!isConnected 
                  ? 'Connect your wallet to deploy your token'
                  : 'Deploy your token to power your space economy'}
              </p>
            </div>
            {!isConnected ? (
              <button
                onClick={connectWallet}
                className="w-full md:w-auto justify-center px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <span>Connect Wallet</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                
                {deployStep === 'initial' && (
                  <button
                    onClick={() => {
                      setTokenName(neynarUser?.username || '');
                      setDeployStep('name');
                    }}
                    disabled={isDeploying || isSigning}
                    className="w-full md:w-auto justify-center px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Deploy</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                )}

                {deployStep === 'name' && (
                  <div className="flex items-center gap-2 w-full md:w-auto animate-in fade-in slide-in-from-right-4 duration-300">
                    <input
                      type="text"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder="Token Name"
                      className="flex-1 md:flex-none px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:border-purple-500/50 w-full md:w-40"
                      autoFocus
                    />
                    <button
                      onClick={() => setDeployStep('symbol')}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                )}

                {deployStep === 'symbol' && (
                  <div className="flex items-center gap-2 w-full md:w-auto animate-in fade-in slide-in-from-right-4 duration-300">
                    <button
                      onClick={() => setDeployStep('name')}
                      className="p-2 text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      placeholder="Symbol"
                      className="flex-1 md:flex-none px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:border-purple-500/50 w-full md:w-24"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        setShowAirdropPopup(true);
                      }}
                      disabled={isDeploying || isSigning || !tokenSymbol}
                      className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>{isSigning ? 'Signing...' : isDeploying ? 'Deploying...' : 'Deploy'}</span>
                      {!isDeploying && !isSigning && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      
      {/* Airdrop Popup */}
      {showAirdropPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-2xl">🪂</span> Airdrop List
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                  Distributing <span className="text-cyan-400 font-mono">250,000,000</span> {tokenSymbol} tokens
                </p>
              </div>
              <button 
                onClick={() => setShowAirdropPopup(false)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {isProfilesLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p>Loading eligible profiles...</p>
                </div>
              ) : airdropProfiles.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                     <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={selectedProfiles.size === airdropProfiles.length && airdropProfiles.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-500/50 focus:ring-offset-0 cursor-pointer"
                        />
                        <span>User</span>
                     </div>
                    <span>Wallet & Allocation</span>
                  </div>
                  {airdropProfiles.map((profile) => {
                    const isSelected = selectedProfiles.has(profile.farcasterId);
                    return (
                    <div 
                      key={profile.farcasterId} 
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-slate-800/60 border-purple-500/30' 
                          : 'bg-slate-900/40 border-slate-800 opacity-60 hover:opacity-100 hover:bg-slate-800/40'
                      }`}
                      onClick={() => toggleProfileSelection(profile.farcasterId)}
                    >
                      <div className="flex items-center gap-3">
                         <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by parent div click
                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-500/50 focus:ring-offset-0 pointer-events-none"
                         />
                         <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden">
                           {profile.pfpUrl ? (
                             <img src={profile.pfpUrl} alt={profile.farcasterUsername} className="w-full h-full object-cover" />
                           ) : (
                             <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                               {profile.farcasterUsername.slice(0, 2).toUpperCase()}
                             </div>
                           )}
                         </div>
                         <div>
                           <div className={`font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>{profile.farcasterName}</div>
                           <div className="text-xs text-slate-500">@{profile.farcasterUsername}</div>
                         </div>
                      </div>
                      <div className="text-right">
                        {isSelected && (
                          <div className="font-mono text-cyan-400 text-sm animate-in fade-in slide-in-from-right-4">
                            {(250000000 / (selectedProfiles.size || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </div>
                        )}
                        <div className="text-xs text-slate-500 font-mono">
                          {profile.verified_addresses.eth_addresses[0].slice(0, 6)}...{profile.verified_addresses.eth_addresses[0].slice(-4)}
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 bg-slate-800/20 rounded-xl border border-slate-800 border-dashed">
                  <p>No eligible profiles found in your social graph.</p>
                  <p className="text-sm mt-2">Make sure you have processed your social graph and your connections have verified ETH addresses.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/50">
               <div className="flex items-center justify-between mb-4 text-sm">
                 <span className="text-slate-400">Total Recipients</span>
                 <div className="flex items-center gap-2">
                   <span className="text-white font-bold">{selectedProfiles.size}</span>
                   <span className="text-slate-500">of {airdropProfiles.length} eligible</span>
                 </div>
               </div>
               <div className="flex gap-3">
                 <button 
                   onClick={() => setShowAirdropPopup(false)}
                   className="flex-1 py-3 px-4 rounded-xl font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                 >
                   Cancel
                 </button>
                 <button
                   onClick={handleDeploy}
                   disabled={isDeploying || isSigning || selectedProfiles.size === 0}
                   className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-cyan-600 hover:opacity-90 text-white rounded-xl font-bold shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                 >
                   {isSigning ? 'Signing...' : isDeploying ? 'Deploying...' : 'Confirm & Deploy'}
                   {!isSigning && !isDeploying && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                   )}
                 </button>
               </div>
            </div>
          </motion.div>
        </div>
      )}
      </section>
      )}

      {/* Live Spaces Section */}
      <main className="flex-1 px-6">
        {/* Live Spaces */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-lg font-semibold text-white">Live Spaces</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-cyan-500/20 text-cyan-400 rounded-full">
              {activeSpaces.length}
            </span>
          </div>

          {activeSpaces.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeSpaces.map((space) => {
                const hostData = hostDataMap[space.hostSlug];
                return (
                  <motion.div
                    key={space.hostSlug}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative rounded-2xl overflow-hidden cursor-pointer group"
                    onClick={() => router.push(`/spaces/${space.hostSlug}`)}
                  >
                    {/* Background with host avatar */}
                    <div 
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ 
                        backgroundImage: hostData?.imageUrl 
                          ? `url(${hostData.imageUrl})` 
                          : 'linear-gradient(to br, #7c3aed, #06b6d4)' 
                      }}
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/60" />
                    
                    {/* Content */}
                    <div className="relative p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {hostData?.imageUrl && (
                          <img 
                            src={hostData.imageUrl} 
                            alt={space.hostSlug}
                            className="w-14 h-14 rounded-full border-2 border-green-400 shadow-lg shadow-green-400/20"
                          />
                        )}
                        <div>
                          <h3 className="font-semibold text-white text-lg">
                            @{space.hostSlug}
                          </h3>
                          <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            {space.participantCount} {space.participantCount === 1 ? 'listener' : 'listeners'}
                          </div>
                        </div>
                      </div>
                      <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-xl font-medium text-sm hover:opacity-90 transition-opacity">
                        Join
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800/60">
              <p className="text-slate-500">No active spaces</p>
              <p className="text-sm text-slate-600 mt-1">
                Tap the orb below to create one
              </p>
            </div>
          )}
        </div>

        {/* Space Host Tokens Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🪙</span>
            <h2 className="text-lg font-semibold text-white">Space Host Tokens</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 rounded-full">
              {deployedTokens.length}
            </span>
          </div>

          {deployedTokens.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deployedTokens.map((token) => (
                <motion.div
                  key={token.hostSlug}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/60 hover:border-purple-500/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {token.imageUrl && (
                      <img 
                        src={token.imageUrl} 
                        alt={token.name}
                        className="w-12 h-12 rounded-full border-2 border-purple-500/50"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">
                        {token.name}
                      </h3>
                      <p className="text-sm text-slate-400">
                        ${token.symbol} • @{token.hostSlug}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/spaces/${token.hostSlug}`);
                      }}
                      className="px-3 py-1.5 text-sm font-medium bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors whitespace-nowrap"
                    >
                      View Space
                    </button>
                  </div>
                  {token.tokenAddress && (
                    <a
                      href={`https://www.empirebuilder.world/empire/${token.tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="block mt-2 text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                      View on Empire Builder →
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800/60">
              <p className="text-slate-500">No host tokens yet</p>
              <p className="text-sm text-slate-600 mt-1">
                Deploy your token to appear here
              </p>
            </div>
          )}
        </div>

        {/* Your Social Graph Section */}
        {isAuthenticated && neynarUser && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🕸️</span>
              <h2 className="text-lg font-semibold text-white">Your Social Graph</h2>
            </div>
            <p className="text-sm text-slate-400 mb-6 max-w-2xl">
              Visualize your Farcaster connections in real-time. This interactive graph shows your followers and who you follow.
            </p>
            <SocialGraph currentUser={neynarUser} />
          </div>
        )}
      </main>
    </div>
  );
}
