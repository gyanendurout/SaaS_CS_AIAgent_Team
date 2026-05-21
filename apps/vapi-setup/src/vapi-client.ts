/**
 * Thin typed wrapper around the Vapi HTTP API.
 *
 * Intentionally minimal: no retries, no logging of secrets, no enumeration
 * helpers. Every method is single-assistant-scoped except `createAssistant`.
 */

const BASE_URL = 'https://api.vapi.ai';

export interface VapiClientOptions {
  apiKey: string;
}

export interface VapiAssistant {
  id: string;
  name?: string;
  model?: {
    provider?: string;
    model?: string;
    systemPrompt?: string;
    tools?: unknown[];
  };
  voice?: { provider?: string; voiceId?: string };
  firstMessage?: string;
  serverUrl?: string;
  [key: string]: unknown;
}

export class VapiError extends Error {
  override readonly name = 'VapiError';
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: string,
    readonly method: string,
    readonly url: string,
  ) {
    super(
      `Vapi ${method} ${url} failed: ${status} ${statusText}\n${body.slice(0, 500)}`,
    );
  }
}

async function request(
  apiKey: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  pathname: string,
  body?: unknown,
): Promise<unknown> {
  const url = `${BASE_URL}${pathname}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const res = await fetch(url, init);

  // DELETE may return 204 No Content; some endpoints return empty bodies.
  const text = await res.text();
  if (!res.ok) {
    throw new VapiError(res.status, res.statusText, text, method, url);
  }
  if (text === '' || text === null) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Endpoint returned non-JSON; surface raw text for the caller.
    return text;
  }
}

export class VapiClient {
  constructor(private readonly opts: VapiClientOptions) {
    if (!opts.apiKey) {
      throw new Error('VapiClient requires apiKey');
    }
  }

  /** GET /assistant/{id} */
  async getAssistant(id: string): Promise<VapiAssistant> {
    if (!id) throw new Error('getAssistant requires an id');
    const out = (await request(
      this.opts.apiKey,
      'GET',
      `/assistant/${encodeURIComponent(id)}`,
    )) as VapiAssistant;
    return out;
  }

  /** POST /assistant — creates a new assistant. Returns the created record (incl. new id). */
  async createAssistant(
    payload: Record<string, unknown>,
  ): Promise<VapiAssistant> {
    const out = (await request(
      this.opts.apiKey,
      'POST',
      '/assistant',
      payload,
    )) as VapiAssistant;
    return out;
  }

  /** PATCH /assistant/{id} — partial update. Used for webhook URL changes. */
  async updateAssistant(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<VapiAssistant> {
    if (!id) throw new Error('updateAssistant requires an id');
    const out = (await request(
      this.opts.apiKey,
      'PATCH',
      `/assistant/${encodeURIComponent(id)}`,
      patch,
    )) as VapiAssistant;
    return out;
  }

  /** DELETE /assistant/{id} */
  async deleteAssistant(id: string): Promise<void> {
    if (!id) throw new Error('deleteAssistant requires an id');
    await request(
      this.opts.apiKey,
      'DELETE',
      `/assistant/${encodeURIComponent(id)}`,
    );
  }
}
