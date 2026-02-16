# Agent Collaboration: Enable inter-agent communication for coordinated creative output

> **GitHub Issue Title:** Agent Collaboration: Enable inter-agent communication for coordinated creative output
>
> **Labels:** `enhancement`, `agents`, `collaboration`

## Summary

Agents currently work **independently** on the same canvas. Each agent reads the full canvas state before acting, but there is **no mechanism for agents to explicitly share ideas, intentions, or creative direction** with each other. This limits the complexity and coherence of multi-agent output.

**Goal:** Enable agents to collaborate so that one agent's creative output (e.g., a song) can directly influence another agent's work (e.g., a painting that matches the song's mood). Agents should share themes, intentions, and react to each other's contributions in real-time.

---

## Current Architecture Analysis

### What exists today
- **5 agent personas** defined in `apps/api/src/agent/agent-registry.ts`: Idea Weaver (brainstormer), Scene Painter (architect), Songwriter (coder), Storyteller (analyst), Creative Curator (canvas-agent)
- **AgentRunnerService** (`apps/api/src/agent/agent-runner.service.ts`) executes agents in a fire-and-forget LLM tool-calling loop (max 10 rounds)
- **Max 3 concurrent agents** per canvas (`MAX_CONCURRENT_SESSIONS_PER_CANVAS = 3`)
- **Implicit sharing only**: agents read existing canvas state (nodes/edges) at loop start — they see what others built but don't know *why* or *what's coming next*
- **Multi-agent hint**: a single line in context says "N other agents are also working" (line ~191 of `agent-runner.service.ts`) — no detail about who or what they're doing
- **Agent sessions table** (`005_create_agent_sessions.sql`) has an unused `context JSONB` field
- **AgentSchedulerService** (`apps/api/src/agent/agent-scheduler.service.ts`) randomly picks a canvas + persona + prompt every 45s — no coordination between scheduled runs
- **5 canvas tools** available to agents: `create_node`, `update_node`, `delete_node`, `create_edge`, `delete_edge` — no communication tools

### Key gap
Agents cannot:
1. Declare their creative intent before starting work
2. Read what other agents are working on or planning
3. React to another agent's specific contribution (only the raw nodes/edges, not the artistic meaning)
4. Request a specific agent to complement their work
5. Share a creative brief or theme

---

## Proposed Design: Shared Creative Context + Collaboration Tools

### 1. Canvas-Level Shared Context Board (Database)

Create a new `canvas_shared_context` table that stores structured creative context per canvas. Any agent can read and write to it.

**New migration: `008_create_canvas_shared_context.sql`**
```sql
CREATE TABLE canvas_shared_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'theme',           -- overarching creative theme/mood
    'intention',       -- what the agent plans to do next
    'contribution',    -- summary of what the agent just created
    'request',         -- request for another agent to do something
    'reaction'         -- response to another agent's contribution
  )),
  content JSONB NOT NULL DEFAULT '{}',
  -- content schema examples:
  -- theme:        { "mood": "melancholic", "palette": ["#d0ebff","#ffe3e3"], "keywords": ["rain","solitude"] }
  -- intention:    { "plan": "Writing a verse about longing", "targetArea": {"x":400,"y":200}, "forPersona": null }
  -- contribution: { "summary": "Created chorus about ocean waves", "nodeIds": ["uuid1","uuid2"], "mood": "uplifting" }
  -- request:      { "targetPersona": "architect", "ask": "Paint a scene matching this melancholic verse", "refNodeIds": ["uuid1"] }
  -- reaction:     { "toEntryId": "uuid-of-contribution", "response": "Added visual echoes of the rain imagery" }
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shared_context_canvas ON canvas_shared_context(canvas_id);
CREATE INDEX idx_shared_context_type ON canvas_shared_context(canvas_id, entry_type);
```

### 2. New Agent Collaboration Tools

Add 3 new LLM-callable tools in `apps/api/src/agent/agent-tools.ts`:

```typescript
// New tools to add to CANVAS_TOOLS array:

{
  name: 'share_creative_context',
  description: 'Share a theme, intention, contribution summary, or request with other agents on this canvas. Other agents will see this in their context and can react to it.',
  parameters: {
    type: 'object',
    required: ['entryType', 'content'],
    properties: {
      entryType: {
        type: 'string',
        enum: ['theme', 'intention', 'contribution', 'request', 'reaction'],
        description: 'Type of shared context entry'
      },
      content: {
        type: 'object',
        description: 'Structured content. For themes: {mood, palette, keywords}. For intentions: {plan, targetArea}. For contributions: {summary, nodeIds, mood}. For requests: {targetPersona, ask, refNodeIds}. For reactions: {toEntryId, response}.',
      }
    }
  }
},

{
  name: 'read_shared_context',
  description: 'Read the current shared creative context from other agents. Returns recent themes, intentions, contributions, and requests.',
  parameters: {
    type: 'object',
    properties: {
      entryType: {
        type: 'string',
        enum: ['theme', 'intention', 'contribution', 'request', 'reaction'],
        description: 'Filter by entry type. Omit to get all.'
      },
      limit: {
        type: 'number',
        description: 'Max entries to return (default: 20)'
      }
    }
  }
},

{
  name: 'request_agent',
  description: 'Request a specific agent persona to respond to your work. For example, ask the Scene Painter to illustrate your song lyrics. The requested agent will be invoked automatically.',
  parameters: {
    type: 'object',
    required: ['targetPersona', 'prompt'],
    properties: {
      targetPersona: {
        type: 'string',
        enum: ['brainstormer', 'architect', 'coder', 'analyst', 'canvas-agent'],
        description: 'The agent persona to invoke'
      },
      prompt: {
        type: 'string',
        description: 'What you want the other agent to do, with creative context'
      },
      refNodeIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Node IDs that the target agent should reference or build upon'
      }
    }
  }
}
```

### 3. Shared Context Repository

**New file: `apps/api/src/agent/shared-context.repository.ts`**

```typescript
@Injectable()
export class SharedContextRepository {
  constructor(@Inject(PG_POOL) private readonly pg: Pool) {}

  async addEntry(canvasId, sessionId, agentName, entryType, content): Promise<SharedContextRow>
  async getRecentEntries(canvasId, options?: { entryType?, limit?, excludeSessionId? }): Promise<SharedContextRow[]>
  async getActiveThemes(canvasId): Promise<SharedContextRow[]>
  async getOpenRequests(canvasId, targetPersona?): Promise<SharedContextRow[]>
  async pruneExpired(canvasId): Promise<number>
}
```

### 4. Enhanced Agent Context Building

Modify `runAgentLoop()` in `apps/api/src/agent/agent-runner.service.ts` to inject shared context into the agent's prompt. After the existing canvas context block (around line 194-207), add:

```typescript
// Fetch shared creative context from other agents
const sharedEntries = await this.sharedContext.getRecentEntries(canvasId, {
  excludeSessionId: sessionId,  // don't show agent its own entries
  limit: 15,
});

const pendingRequests = await this.sharedContext.getOpenRequests(canvasId, agentType);

let collaborationContext = '';
if (sharedEntries.length > 0) {
  collaborationContext += '\n\n## Creative context from other agents:\n';
  for (const entry of sharedEntries) {
    collaborationContext += `- [${entry.agent_name}] (${entry.entry_type}): ${JSON.stringify(entry.content)}\n`;
  }
}
if (pendingRequests.length > 0) {
  collaborationContext += '\n## Requests directed at you:\n';
  for (const req of pendingRequests) {
    collaborationContext += `- [${req.agent_name}] asks: ${JSON.stringify(req.content)}\n`;
  }
  collaborationContext += '\nPlease address these requests in your work if relevant.\n';
}
```

### 5. Collaboration-Aware System Prompts

Update `BASE_INSTRUCTIONS` in `apps/api/src/agent/agent-registry.ts` to add collaboration guidance:

```
## Collaboration with other agents
- Before creating content, share your creative intention using share_creative_context (type: "intention").
- After creating a meaningful piece, share a contribution summary so other agents can react to it.
- Check shared context from other agents and try to harmonize your work with active themes.
- If another agent has requested your help (check requests), prioritize responding to that request.
- Use request_agent to ask a complementary persona to extend your work (e.g., ask Scene Painter to illustrate your lyrics).
- React to other agents' contributions when your work relates to theirs.
```

### 6. Agent-Triggered Invocation (request_agent tool)

When an agent uses `request_agent`, the tool handler in `executeTool()` should:

1. Write a `request` entry to `canvas_shared_context`
2. Invoke `AgentRunnerService.invoke()` with the target persona and a prompt that references the requesting agent's work
3. Include `refNodeIds` in the new agent's `context.selectedNodeIds`
4. Return success with the new session ID

This enables chains like:
- Songwriter creates lyrics -> requests Scene Painter to illustrate -> Scene Painter reads the lyrics nodes + shared context -> paints matching visual scene -> shares contribution summary -> Idea Weaver sees both and connects themes

### 7. Broadcast Collaboration Events to Viewers

Add new WebSocket events in `AgentBroadcastService` so viewers can see collaboration happening:

```typescript
broadcastAgentCollaboration(canvasId, sessionId, {
  type: 'shared_context' | 'agent_request' | 'agent_reaction',
  fromAgent: string,
  toAgent?: string,
  summary: string
})
```

**New WS event: `agent:collaboration`** — displayed in the ActivityFeed to show viewers that agents are communicating.

### 8. Enhanced Scheduler with Collaboration Awareness

Update `AgentSchedulerService` to:
- Check for unanswered `request` entries before randomly picking an agent
- If requests exist, prioritize invoking the requested persona with a prompt that references the request
- Include collaboration prompts like "Check the shared context and respond to any pending requests or themes"

---

## Implementation Plan (Ordered Steps)

### Phase 1: Database & Repository
1. Create migration `008_create_canvas_shared_context.sql`
2. Create `SharedContextRepository` with CRUD + pruning methods
3. Add shared types to `packages/shared/src/agent-types.ts` (`SharedContextEntry`, `SharedContextEntryType`)

### Phase 2: Collaboration Tools
4. Add 3 new tool definitions to `apps/api/src/agent/agent-tools.ts`
5. Add tool execution handlers in `AgentRunnerService.executeTool()` for `share_creative_context`, `read_shared_context`, `request_agent`
6. Wire `SharedContextRepository` into `AgentModule`

### Phase 3: Context Injection
7. Modify `runAgentLoop()` to fetch and inject shared context into agent prompts
8. Update `BASE_INSTRUCTIONS` in `agent-registry.ts` with collaboration guidance
9. Update per-persona prompts with collaboration-specific hints (e.g., Songwriter: "share your lyrics summary so the Scene Painter can illustrate")

### Phase 4: Agent-to-Agent Invocation
10. Implement `request_agent` tool handler that invokes `AgentRunnerService.invoke()` with collaboration context
11. Add safeguards: max chain depth (prevent infinite agent-invokes-agent loops), rate limiting, concurrency checks

### Phase 5: Frontend Visualization
12. Add `agent:collaboration` WebSocket event to `ServerToClientEvents` in shared types
13. Add broadcast method in `AgentBroadcastService`
14. Update `canvas-store.ts` to track collaboration events
15. Update `ActivityFeed.tsx` to display collaboration events (e.g., "Songwriter requested Scene Painter to illustrate the verse")

### Phase 6: Scheduler Integration
16. Update `AgentSchedulerService` to check for pending requests before random scheduling
17. Add collaboration-aware prompt templates

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `apps/api/src/database/migrations/008_create_canvas_shared_context.sql` | **NEW** — shared context table |
| `apps/api/src/agent/shared-context.repository.ts` | **NEW** — DB repository |
| `apps/api/src/agent/agent-tools.ts` | Add 3 collaboration tools |
| `apps/api/src/agent/agent-runner.service.ts` | Tool handlers + context injection in `runAgentLoop()` + `executeTool()` |
| `apps/api/src/agent/agent-registry.ts` | Collaboration instructions in prompts |
| `apps/api/src/agent/agent.module.ts` | Register `SharedContextRepository` |
| `apps/api/src/agent/agent-scheduler.service.ts` | Request-aware scheduling |
| `apps/api/src/collaboration/agent-broadcast.service.ts` | `broadcastAgentCollaboration()` method |
| `packages/shared/src/agent-types.ts` | `SharedContextEntry` type |
| `packages/shared/src/ws-events.ts` | `agent:collaboration` event type |
| `apps/web/src/stores/canvas-store.ts` | Track collaboration events |
| `apps/web/src/hooks/use-canvas-socket.ts` | Subscribe to `agent:collaboration` |
| `apps/web/src/components/canvas/ActivityFeed.tsx` | Display collaboration in feed |

---

## Safeguards

- **Max invocation chain depth**: `request_agent` should include a `depth` counter; refuse if depth > 3 to prevent infinite loops
- **Rate limiting**: No more than 1 `request_agent` call per agent session
- **Context pruning**: Shared context entries expire after 1 hour; prune on each read
- **Concurrency check**: `request_agent` must respect `MAX_CONCURRENT_SESSIONS_PER_CANVAS` — queue or skip if at capacity
- **Context size limit**: Cap shared context injection to ~2000 tokens to avoid bloating LLM prompts

---

## Example Collaboration Flow

1. **AgentSchedulerService** invokes **Songwriter** on a canvas
2. Songwriter calls `share_creative_context({ entryType: "intention", content: { plan: "Writing a melancholic verse about rain on windows" } })`
3. Songwriter creates lyric nodes on the canvas (sticky_notes with verse/chorus)
4. Songwriter calls `share_creative_context({ entryType: "contribution", content: { summary: "Wrote 4-line verse about rain and longing", nodeIds: ["n1","n2","n3"], mood: "melancholic" } })`
5. Songwriter calls `request_agent({ targetPersona: "architect", prompt: "Paint a visual scene that captures the melancholic rain imagery from my lyrics", refNodeIds: ["n1","n2","n3"] })`
6. **Scene Painter** is auto-invoked, sees in context: shared theme (melancholic), contribution from Songwriter (rain lyrics), and the request
7. Scene Painter reads the referenced nodes, creates visual scene nodes with matching palette, and connects them to the lyrics with edges labeled "illustrates" and "echoes"
8. Scene Painter calls `share_creative_context({ entryType: "reaction", content: { toEntryId: "songwriter-contribution-id", response: "Created rainy windowpane scene with cool blue palette to match the longing mood" } })`
9. Viewers see all of this in the **ActivityFeed**: "Songwriter shared intention -> wrote melancholic verse -> requested Scene Painter -> Scene Painter reacted with matching visual scene"
