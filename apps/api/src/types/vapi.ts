/**
 * Vapi webhook payload types.
 *
 * Vapi posts a single envelope `{ message: { type, ... } }`. We model the
 * subset of fields we actually consume — the spec changes; `unknown` for the
 * rest keeps us forwards-compatible without lying about the shape.
 *
 * Reference: https://docs.vapi.ai/server-url
 */

export type VapiMessageType =
  | 'transcript'
  | 'function-call'
  | 'tool-calls'
  | 'end-of-call-report'
  | 'status-update'
  | 'speech-update'
  | 'conversation-update'
  | 'hang'
  | 'user-interrupted';

/** Lightweight call context attached to most message types. */
export interface VapiCall {
  id?: string;
  assistantId?: string;
  customer?: {
    number?: string;
    email?: string;
    name?: string;
  };
  metadata?: Record<string, unknown> & {
    /** Set by our customer-demo before starting a Vapi web call. */
    claim_id?: string;
    customer_id?: string;
  };
}

export interface VapiTranscriptMessage {
  type: 'transcript';
  transcriptType?: 'partial' | 'final';
  role: 'user' | 'assistant' | 'system';
  transcript: string;
  call?: VapiCall;
}

export interface VapiFunctionCall {
  name: string;
  parameters?: Record<string, unknown>;
  /** Some Vapi versions stringify parameters into `arguments`. */
  arguments?: string;
}

export interface VapiFunctionCallMessage {
  type: 'function-call' | 'tool-calls';
  functionCall?: VapiFunctionCall;
  /** Newer "tool-calls" wrapper. */
  toolCallList?: Array<{
    id: string;
    function: VapiFunctionCall;
  }>;
  call?: VapiCall;
}

export interface VapiEndOfCallMessage {
  type: 'end-of-call-report';
  endedReason?: string;
  recordingUrl?: string;
  summary?: string;
  transcript?: string;
  durationSeconds?: number;
  cost?: number;
  call?: VapiCall;
}

export interface VapiStatusUpdateMessage {
  type: 'status-update';
  status?: string;
  call?: VapiCall;
}

export type VapiAnyMessage =
  | VapiTranscriptMessage
  | VapiFunctionCallMessage
  | VapiEndOfCallMessage
  | VapiStatusUpdateMessage
  | { type: VapiMessageType; call?: VapiCall; [k: string]: unknown };

export interface VapiWebhookEnvelope {
  message: VapiAnyMessage;
}

/**
 * The function-call response envelope Vapi expects back from a tool endpoint.
 * `result` is read by the model on the next turn.
 */
export interface VapiToolResultEnvelope {
  result: unknown;
}
