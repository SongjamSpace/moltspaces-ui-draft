"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Room } from '@/services/db/rooms.db';

interface RoomPlayerContextType {
  activeRoom: Room | null;
  isMinimized: boolean;
  openRoom: (room: Room) => void;
  closeRoom: () => void;
  minimizeRoom: () => void;
  maximizeRoom: () => void;
}

const RoomPlayerContext = createContext<RoomPlayerContextType | undefined>(undefined);

export function RoomPlayerProvider({ children }: { children: ReactNode }) {
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const openRoom = (room: Room) => {
    setActiveRoom(room);
    setIsMinimized(false);
  };

  const closeRoom = () => {
    setActiveRoom(null);
    setIsMinimized(false);
  };

  const minimizeRoom = () => setIsMinimized(true);
  const maximizeRoom = () => setIsMinimized(false);

  return (
    <RoomPlayerContext.Provider
      value={{
        activeRoom,
        isMinimized,
        openRoom,
        closeRoom,
        minimizeRoom,
        maximizeRoom,
      }}
    >
      {children}
    </RoomPlayerContext.Provider>
  );
}

export function useRoomPlayer() {
  const context = useContext(RoomPlayerContext);
  if (context === undefined) {
    throw new Error('useRoomPlayer must be used within a RoomPlayerProvider');
  }
  return context;
}
