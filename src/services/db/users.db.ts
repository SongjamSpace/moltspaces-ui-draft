import { db, logFirebaseEvent } from "../firebase.service";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { User as FirebaseUser, AdditionalUserInfo } from "firebase/auth";

export interface StoredUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  twitterId?: string;
  username?: string;
  createdAt?: any;
}

export const createUser = async (user: FirebaseUser, additionalUserInfo: AdditionalUserInfo | null) => {
  if (!user) return;

  const userRef = doc(db, "users", user.uid);

  // Extract Twitter info
  // Even if not new user, we might want these available to update? 
  // But user said "just use it to save the doc", implying only creation.
  // However, I need to extract info to save it.
  
  let twitterId = "";
  let username = "";

  if (additionalUserInfo) {
    const profile = additionalUserInfo.profile as any;
    // Twitter specific. profile usually has 'id_str' or 'id' and 'screen_name' or 'data.username' depending on API version used by Firebase
    // But let's stick to what worked in providers.tsx or verify.
    // In providers.tsx transparency: user.providerData...
    // additionalUserInfo.profile is the raw profile from provider.
    // Let's use the same logic as providers.tsx for consistency if possible, or enhance.
    // providers.tsx used: 
    // const twitterInfo = user.providerData.find((p) => p.providerId === "twitter.com");
    // const twitterId = twitterInfo?.uid;
    // const username = (user as any)?.reloadUserInfo?.screenName;
    
    // Let's replicate this extraction logic here to be safe and consistent, 
    // unless additionalUserInfo provides it cleaner.
  }

  // Actually, additionalUserInfo is handy for isNewUser check, but for data extraction, 
  // the user object already has most of what we need (providerData).
  // I will pass 'user' and 'additionalUserInfo' to this component.

  const twitterInfo = user.providerData.find(
    (p) => p.providerId === "twitter.com"
  );
  twitterId = twitterInfo?.uid || "";
  username = (user as any)?.reloadUserInfo?.screenName || "";

  // "just use it to save the doc. no need to always be checking the doc existence"
  // So if isNewUser is true, we simply setDoc.
  if (additionalUserInfo?.isNewUser) {
    try {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        twitterId,
        username,
        createdAt: serverTimestamp(),
      });

      logFirebaseEvent("sign_up", {
        method: "twitter",
        user_id: user.uid,
      });
    } catch (error) {
      console.error("Error creating user in DB:", error);
      throw error;
    }
  } else {
    // Optional: update last login?
    // User said "no need to always be checking the doc existence". 
    // If I just want to be safe, I can do nothing here, OR
    // just update lastLogin blindly with merge: true?
    // "No need to always be checking" implies avoiding the read cost.
    // Updating lastLogin is a write cost.
    // I will skip updating lastLogin for now unless user asks, or just do it blindly.
    // User's specific request "once the X sign in happens, i want their details to be stored... no need to always be checking".
    // I think isNewUser check covers the "checking" part.
    // So ONLY write if isNewUser.
    
    // BUT what if existing user logs in unrelatedly? 
    // The previous implementation updated 'lastLogin' and 'username', 'displayName'.
    // If we only write on new user, we miss updates to profile.
    // But user specifically said "just use it to save the doc".
    // I'll stick to ONLY creating if isNewUser for now to match "no need to checking" constraint strictly.
    // Wait, if I use merge=true, I don't need to check existence.
    // But user said "firebase also provides if they are signing for the first time... just use it".
    // So I will rely on isNewUser.
  }
};
