import { collection, doc, onSnapshot, Unsubscribe, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase.service";

export interface ProcessFarcasterProfile {
  twitterId: string;
  twitterUsername: string;
  farcasterId: string;
  farcasterUsername: string;
  farcasterName: string;
  type: "follower" | "following";
  pfpUrl?: string;
  experimental: {
    neynar_user_score: number;
  }
  viewerContext: {
    following: boolean;
    followed_by: boolean;
    blocking: boolean;
    blocked_by: boolean;
  }
}

export interface ProcessMetadata {
  twitterUsername: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt?: number;
  updatedAt?: number;
  pfpUrl?: string;
  farcasterUsername?: string;
  fid?: number;
  message?: string;
}

const PROCESS_FARCASTER_COLLECTION = "process_farcaster";

export const subscribeToProcessMetadata = (
  twitterUsername: string,
  onUpdate: (data: ProcessMetadata | null) => void
): Unsubscribe => {
  const docRef = doc(db, PROCESS_FARCASTER_COLLECTION, twitterUsername);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data() as ProcessMetadata);
    } else {
      onUpdate(null);
    }
  });
};

export const subscribeToProcessProfiles = (
  twitterUsername: string,
  onUpdate: (profiles: ProcessFarcasterProfile[], totalCount: number) => void,
  onError?: (error: any) => void
): Unsubscribe => {
  const collectionRef = collection(
    db,
    PROCESS_FARCASTER_COLLECTION,
    twitterUsername,
    "profiles"
  );

  return onSnapshot(
    collectionRef,
    (querySnapshot) => {
      const profiles: ProcessFarcasterProfile[] = [];
      querySnapshot.forEach((doc) => {
        profiles.push(doc.data() as ProcessFarcasterProfile);
      });
      onUpdate(profiles, querySnapshot.size);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
};

export const updateProfileFollow = async (twitterUsername: string, targetFid: string, viewerContext: ProcessFarcasterProfile['viewerContext']) => {
  const collectionRef = doc(
    db,
    PROCESS_FARCASTER_COLLECTION,
    twitterUsername,
    "profiles",
    targetFid
  );

  await updateDoc(collectionRef, {
    viewerContext: {
      ...viewerContext,
      following: true,
    }
  })    
}