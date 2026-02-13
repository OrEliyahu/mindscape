'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@mindscape/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
const NAMESPACE = '/canvas';

let socket: TypedSocket | null = null;
let refCount = 0;

function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(`${SOCKET_URL}${NAMESPACE}`, {
      autoConnect: false,
      transports: ['websocket'],
    }) as TypedSocket;
  }
  return socket;
}

export function useSocket(): TypedSocket {
  const socketRef = useRef<TypedSocket>(getSocket());

  useEffect(() => {
    const s = socketRef.current;
    refCount++;
    if (!s.connected) {
      s.connect();
    }

    return () => {
      refCount--;
      if (refCount <= 0) {
        s.disconnect();
        socket = null;
        refCount = 0;
      }
    };
  }, []);

  return socketRef.current;
}
