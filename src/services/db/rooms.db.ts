import { db } from '../firebase.service';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    getDocs,
    doc,
    getDoc,
    Timestamp,
} from 'firebase/firestore';

export interface Room {
  room_id: string; // This will now be room_name for new rooms
  daily_id?: string; // Original Daily UUID
  title: string;
  agent_name: string;
  agent_id: string;
  room_name: string;
  room_url: string;
  created_at: number;
  participant_count?: number;
  is_live?: boolean;
  start_ts?: number;
  end_ts?: number;
}

export interface Session {
  session_id: string;
  user_id?: string;
  user_name?: string;
  owner?: boolean;
  joined_at: number;
  left_at?: number;
  duration?: number;
}

const ROOMS_COLLECTION = 'rooms';
const SESSIONS_SUB_COLLECTION = "sessions";
/**
 * Query top 20 live rooms ordered by participant count (descending)
 */
export async function queryLiveRooms(): Promise<Room[]> {
    try {
        const roomsRef = collection(db, ROOMS_COLLECTION);
        const q = query(
            roomsRef,
            where('is_live', '==', true),
            orderBy('participant_count', 'desc'),
            limit(20)
        );

        const querySnapshot = await getDocs(q);
        const rooms: Room[] = [];
        
        querySnapshot.forEach((doc) => {
            rooms.push({
                ...doc.data(),
            } as Room);
        });

        return rooms;
    } catch (error) {
        console.error('Error querying live rooms:', error);
        return [];
    }
}

/**
 * Query top 20 latest rooms ordered by lastActivity (descending)
 */
export async function queryLatestRooms(): Promise<Room[]> {
    try {
        const roomsRef = collection(db, ROOMS_COLLECTION);
        const q = query(
            roomsRef,
            orderBy('created_at', 'desc'),
            limit(20)
        );

        const querySnapshot = await getDocs(q);
        const rooms: Room[] = [];
        
        querySnapshot.forEach((doc) => {
            rooms.push({
                ...doc.data(),
            } as Room);
        });

        return rooms;
    } catch (error) {
        console.error('Error querying latest rooms:', error);
        return [];
    }
}

/**
 * Subscribe to live rooms changes
 */
export function subscribeToLiveRooms(
    callback: (rooms: Room[]) => void
): () => void {
    const roomsRef = collection(db, ROOMS_COLLECTION);
    const q = query(
        roomsRef,
        where('is_live', '==', true),
        orderBy('participant_count', 'desc'),
        limit(20)
    );

    const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
            const rooms: Room[] = [];
            querySnapshot.forEach((doc) => {
                rooms.push({
                    ...doc.data(),
                } as Room);
            });
            callback(rooms);
        },
        (error) => {
            console.error('Error in live rooms subscription:', error);
            callback([]);
        }
    );

    return unsubscribe;
}

/**
 * Subscribe to latest rooms changes
 */
export function subscribeToLatestRooms(
    callback: (rooms: Room[]) => void
): () => void {
    const roomsRef = collection(db, ROOMS_COLLECTION);
    const q = query(
        roomsRef,
        orderBy('created_at', 'desc'),
        limit(20)
    );

    const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
            const rooms: Room[] = [];
            querySnapshot.forEach((doc) => {
                rooms.push({
                    ...doc.data(),
                } as Room);
            });
            callback(rooms);
        },
        (error) => {
            console.error('Error in latest rooms subscription:', error);
            callback([]);
        }
    );

    return unsubscribe;
}

/**
 * Get participants from the latest session of a room
 */
export async function getLatestRoomSessionParticipants(roomId: string): Promise<any[]> {
    try {
        const sessionsRef = collection(db, ROOMS_COLLECTION, roomId, 'sessions');
        const q = query(sessionsRef, orderBy('created_at', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const sessionData = snapshot.docs[0].data();
            return sessionData.participants || [];
        }
        return [];
    } catch (error) {
        return [];
    }
}

/**
 * Get a single room by ID
 */
export async function getRoom(roomId: string): Promise<Room | null> {
    try {
        const roomsRef = collection(db, ROOMS_COLLECTION);
        // We query by room_name (which is stored as ID in some contexts, but let's be safe and allow querying)
        // Actually, the document ID IS the room_name/hostSlug usually.
        // Let's try fetching the document directly first.
        const docRef = doc(db, ROOMS_COLLECTION, roomId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as Room;
        }
        
        // Fallback: Query by room_name field if doc ID doesn't match
        const q = query(roomsRef, where("room_name", "==", roomId), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data() as Room;
        }

        return null;
    } catch (error) {
        console.error("Error getting room:", error);
        return null;
    }
}
