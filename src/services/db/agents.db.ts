import { collection, query, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/services/firebase.service";

export interface Agent {
  id: string;
  agentId: string;
  agent_id: string;
  createdAt: Timestamp;
  description: string;
  metadata: Record<string, any>;
  name: string;
  skill_name: string;
  version: string;
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
