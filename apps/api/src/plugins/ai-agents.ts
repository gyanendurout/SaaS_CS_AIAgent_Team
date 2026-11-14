/**
 * AI Agents plugin — typed fetch wrapper around the Python ai-agents service.
 *
 * Endpoints we proxy to:
 *   POST {PYTHON_AI_URL}/tools/evaluate_eligibility
 *   POST {PYTHON_AI_URL}/pipeline/run
 *   POST {PYTHON_AI_URL}/tools/search_knowledge
 *   POST {PYTHON_AI_URL}/tools/search_products
 *
 * Synchronous (no BullMQ) — acceptable since Python responses are <500ms and
 * Vapi handles its own per-tool timeout. If the Python service is down we
 * surface an UpstreamError, logged and converted to 503 at the route layer.
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../env.js';
import { UpstreamError } from '../lib/errors.js';
import type { Decision, EscalationReason } from '../types/domain.js';

export interface EligibilityResult {
  decision: Decision;
  reason_code: string;
  citation: string;
  policy_version: string;
  escalation_reason?: EscalationReason;
}

export interface PipelineRunInput {
  claim_id: string;
  /** Optional hint so the Python side doesn't have to re-lookup. */
  channel: 'voice' | 'email' | 'web';
  /**
   * Free-form intake payload. The Python intake agent normalises this; the
   * `issue` field flows through to the response drafter's user message so
   * replies can address the customer's specific complaint instead of being
   * generic.
   */
  raw_input?: Record<string, unknown>;
}

export interface PipelineRunResult {
  claim_id: string;
  /** Python returns the full DecisionResult object, not just a code string. */
  decision: {
    decision: Decision;
    reason_code: string;
    citation: string;
    policy_version: string;
    escalation_reason?: EscalationReason;
  } | null;
  needs_escalation: boolean;
  draft_id?: string | null;
  escalation_id?: string | null;
  error?: string | null;
}

export interface KnowledgeHit {
  source: string;
  heading: string;
  content: string;
  score: number;
}

export interface SearchKnowledgeResult {
  /** false while ai-agents runs with KNOWLEDGE_SOURCE=static. */
  enabled: boolean;
  results: KnowledgeHit[];
}

export interface ProductVariant {
  title: string | null;
  available: boolean;
  price: number | null;
  compare_at_price: number | null;
}

export interface Product {
  title: string | null;
  url: string | null;
  price: number | null;
  compare_at_price: number | null;
  on_sale: boolean;
  available: boolean;
  variants: ProductVariant[];
  /** true when no exact match existed and a near model is offered instead. */
  closest_match: boolean;
}

export interface SearchProductsResult {
  /** false while ai-agents runs with CATALOG_SOURCE=off. */
  enabled: boolean;
  results: Product[];
}

export interface OrderStatus {
  order_number: string | null;
  placed_on: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  cancelled: boolean;
  items: { title: string | null; quantity: number | null }[];
  shipments: {
    status: string | null;
    carrier: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
  }[];
  returns: { name: string | null; status: string | null }[];
}

export interface GetOrderStatusResult {
  /** false while ai-agents runs with ORDER_SOURCE=off. */
  enabled: boolean;
  /** ok | not_found | needs_verification | invalid_order_number | unavailable | disabled */
  status: string;
  order: OrderStatus | null;
}

export interface LiveOrder extends OrderStatus {
  /** Full email only for allow-listed domains; otherwise masked like p***@g***.com. */
  email_hint: string | null;
}

export interface LiveOrdersResult {
  /** false while ai-agents runs with ORDER_SOURCE=off. */
  enabled: boolean;
  orders: LiveOrder[];
  error?: string | null;
}

export interface AiAgentsClient {
  /**
   * `claimInput` must be in `warranty_policy.ClaimInput` shape (the route is
   * responsible for translating the Vapi tool body to this shape before
   * forwarding). Typed as `unknown` because the route layer owns the schema.
   */
  evaluateEligibility(claimInput: unknown): Promise<EligibilityResult>;
  runPipeline(input: PipelineRunInput): Promise<PipelineRunResult>;
  searchKnowledge(query: string): Promise<SearchKnowledgeResult>;
  searchProducts(query: string): Promise<SearchProductsResult>;
  getOrderStatus(input: {
    order_number: string;
    email?: string;
    postcode?: string;
  }): Promise<GetOrderStatusResult>;
  listLiveOrders(limit: number): Promise<LiveOrdersResult>;
}

declare module 'fastify' {
  interface FastifyInstance {
    aiAgents: AiAgentsClient;
  }
}

const DEFAULT_TIMEOUT_MS = 25_000;
/** Live voice calls can't wait long — on timeout these tools degrade to enabled:false. */
const LIVE_TOOL_TIMEOUT_MS = 5_000;

async function postJson<T>(
  url: string,
  body: unknown,
  log: FastifyInstance['log'],
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.AI_AGENTS_SECRET ? { 'X-Internal-Secret': env.AI_AGENTS_SECRET } : {}),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      log.error(
        { url, status: res.status, body: text.slice(0, 500) },
        '[ai-agents] upstream non-2xx',
      );
      throw new UpstreamError(
        `ai-agents ${url} responded ${res.status}: ${text.slice(0, 200)}`,
        res.status,
      );
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      log.error({ url, parseError: String(err) }, '[ai-agents] non-JSON body');
      throw new UpstreamError(`ai-agents ${url} returned non-JSON`, res.status);
    }
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    log.error({ url, err: message }, '[ai-agents] fetch failed');
    throw new UpstreamError(`ai-agents ${url} unreachable: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

const aiAgentsPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const base = env.PYTHON_AI_URL.replace(/\/+$/, '');

  const client: AiAgentsClient = {
    async evaluateEligibility(input) {
      return postJson<EligibilityResult>(
        `${base}/tools/evaluate_eligibility`,
        input,
        app.log,
      );
    },
    async runPipeline(input) {
      return postJson<PipelineRunResult>(`${base}/pipeline/run`, input, app.log);
    },
    async searchKnowledge(query) {
      return postJson<SearchKnowledgeResult>(
        `${base}/tools/search_knowledge`,
        { query },
        app.log,
        LIVE_TOOL_TIMEOUT_MS,
      );
    },
    async searchProducts(query) {
      return postJson<SearchProductsResult>(
        `${base}/tools/search_products`,
        { query },
        app.log,
        LIVE_TOOL_TIMEOUT_MS,
      );
    },
    async listLiveOrders(limit) {
      return postJson<LiveOrdersResult>(
        `${base}/tools/live_orders`,
        { limit },
        app.log,
        LIVE_TOOL_TIMEOUT_MS,
      );
    },
    async getOrderStatus(input) {
      return postJson<GetOrderStatusResult>(
        `${base}/tools/get_order_status`,
        input,
        app.log,
        LIVE_TOOL_TIMEOUT_MS,
      );
    },
  };

  app.decorate('aiAgents', client);
  app.log.info({ base }, '[ai-agents] client ready');
};

export default fp(aiAgentsPlugin, { name: 'ai-agents' });
