/**
 * Lightweight types for the Vapi Web SDK events we actually use.
 * The SDK's own typings are loose; these tighten only the bits the UI consumes.
 */

export type VoiceStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'processing'
  | 'ended'
  | 'error';

export type TranscriptRole = 'user' | 'assistant';

export type TranscriptLine = {
  id: string;
  role: TranscriptRole;
  text: string;
  /** Partial = the customer is still mid-sentence; final = locked in. */
  final: boolean;
  at: number;
};

export type VapiCallContext = {
  customer_id: string;
  customer_name: string;
  customer_email: string;
};
