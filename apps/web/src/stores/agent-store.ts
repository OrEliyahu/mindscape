import { create } from 'zustand';
import type { AgentSession } from '@mindscape/shared';

interface AgentState {
  sessions: Map<string, AgentSession>;
  activeSessionId: string | null;
}

interface AgentActions {
  addSession: (session: AgentSession) => void;
  updateSession: (id: string, patch: Partial<AgentSession>) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
}

export type AgentStore = AgentState & AgentActions;

export const useAgentStore = create<AgentStore>()((set) => ({
  sessions: new Map(),
  activeSessionId: null,

  addSession: (session) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.set(session.id, session);
      return { sessions };
    }),

  updateSession: (id, patch) =>
    set((state) => {
      const existing = state.sessions.get(id);
      if (!existing) return state;
      const sessions = new Map(state.sessions);
      sessions.set(id, { ...existing, ...patch });
      return { sessions };
    }),

  removeSession: (id) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.delete(id);
      const activeSessionId = state.activeSessionId === id ? null : state.activeSessionId;
      return { sessions, activeSessionId };
    }),

  setActiveSession: (id) =>
    set(() => ({
      activeSessionId: id,
    })),
}));
