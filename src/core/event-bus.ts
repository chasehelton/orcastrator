// Lightweight typed event bus built on Node's EventEmitter

import { EventEmitter } from "node:events";

export interface OrcaEvents {
  "tier.selected": { task: string; tier: string; reason: string };
  "task.started": { task: string; agents: string[] };
  "agent.spawned": { agentName: string; success: boolean };
  "agent.completed": {
    agentName: string;
    success: boolean;
    duration?: number;
  };
  "task.completed": { strategy: string; duration: number; agentCount: number };

  // Agent activity events (relayed from SDK session events)
  "agent.intent": { agentName: string; intent: string };
  "agent.turn.start": { agentName: string; turnId: string };
  "agent.turn.end": { agentName: string; turnId: string };
  "agent.tool.start": {
    agentName: string;
    toolCallId: string;
    toolName: string;
    args?: string;
  };
  "agent.tool.progress": {
    agentName: string;
    toolCallId: string;
    message: string;
  };
  "agent.tool.complete": {
    agentName: string;
    toolCallId: string;
    toolName: string;
    success: boolean;
    snippet?: string;
  };
  "agent.subagent.started": {
    agentName: string;
    subagentName: string;
    description: string;
  };
}

type EventName = keyof OrcaEvents;

export class OrcaEventBus extends EventEmitter {
  override emit<K extends EventName>(
    event: K,
    payload: OrcaEvents[K],
  ): boolean {
    return super.emit(event, payload);
  }

  override on<K extends EventName>(
    event: K,
    listener: (payload: OrcaEvents[K]) => void,
  ): this {
    return super.on(event, listener);
  }

  override off<K extends EventName>(
    event: K,
    listener: (payload: OrcaEvents[K]) => void,
  ): this {
    return super.off(event, listener);
  }

  override once<K extends EventName>(
    event: K,
    listener: (payload: OrcaEvents[K]) => void,
  ): this {
    return super.once(event, listener);
  }
}

const bus = new OrcaEventBus();
export { bus };
export function getEventBus(): OrcaEventBus {
  return bus;
}
