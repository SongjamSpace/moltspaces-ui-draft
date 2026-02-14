import { collection, query, onSnapshot, Timestamp, getDocs, where, doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase.service";

export interface Agent {
  id: string;
  agent_id: string;
  createdAt: Timestamp;
  description: string;
  metadata: Record<string, any>;
  name: string;
  skill_name: string;
  version: string;
  // Verification / Ownership fields
  verified?: boolean;
  isClaimed?: boolean; // True if claimed via Twitter, False if not
  email?: string;
  privyUserId?: string; // Privy User ID
  twitterHandle?: string;
  twitterId?: string;
  username?: string;
  username_lowercase?: string;
}

/**
 * Check if a username is available (case-insensitive)
 * @param username The username to check
 * @returns true if available, false if taken
 */
export async function checkUsernameAvailability(username: string): Promise<boolean> {
  if (!username) return false;
  
  const agentsRef = collection(db, "agents");
  // Query against lowercase version for case-insensitivity
  const q = query(agentsRef, where("username_lowercase", "==", username.toLowerCase()));
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty;
}

/**
 * Subscribe to all agents in the agents collection
 * @param onData Callback when agents data updates
 * @param onError Callback when an error occurs
 * @returns Unsubscribe function
 */
export function subscribeToAgents(
  onData: (agents: Agent[]) => void,
  onError: (error: Error) => void
): () => void {
  const agentsRef = collection(db, "agents");
  const q = query(agentsRef);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const agents: Agent[] = [];
      snapshot.forEach((doc) => {
        agents.push({
          id: doc.id,
          ...doc.data(),
        } as Agent);
      });
      onData(agents);
    },
    (error) => {
      console.error("Error fetching agents:", error);
      onError(error as Error);
    }
  );

  return unsubscribe;
}

/**
 * Get an agent by its agentId (not the document ID)
 * @param agentId The unique agentId string
 * @returns The agent object or null if not found
 */
export async function getAgentByAgentId(agentId: string): Promise<Agent | null> {
  const agentsRef = collection(db, "agents");
  const q = query(agentsRef, where("agent_id", "==", agentId));
  
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  const doc = querySnapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as Agent;
}

/**
 * Update an agent document
 * @param docId The document ID of the agent
 * @param data The data to update
 */
export async function updateAgent(docId: string, data: Partial<Agent>): Promise<void> {
  const agentRef = doc(db, "agents", docId);
  await updateDoc(agentRef, data);
}
