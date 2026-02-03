import { db } from '../firebase.service';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    getDocs,
    Timestamp,
} from 'firebase/firestore';

export interface Room {
    roomId: string;
    title: string;
    agent_name: string;
    agent_id: string;
    roomName: string;
    roomUrl: string;
    createdAt: Timestamp;
    participantCount?: number;
    isLive?: boolean;
    lastActivity?: Timestamp;
}

const ROOMS_COLLECTION = 'rooms';

/**
 * Query top 20 live rooms ordered by participant count (descending)
 */
export async function queryLiveRooms(): Promise<Room[]> {
    try {
        const roomsRef = collection(db, ROOMS_COLLECTION);
        const q = query(
            roomsRef,
            where('isLive', '==', true),
            orderBy('participantCount', 'desc'),
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
            orderBy('lastActivity', 'desc'),
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
        where('isLive', '==', true),
        orderBy('participantCount', 'desc'),
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
        orderBy('lastActivity', 'desc'),
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
