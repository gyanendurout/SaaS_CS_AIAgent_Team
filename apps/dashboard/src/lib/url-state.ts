import type {
  ChannelType,
  DecisionType,
  DisplayStatusType,
  AgentId,
} from './supabase/types';

/**
 * Single source of truth for the Archive's URL filter contract. Every
 * Archive filter lives in the URL so the page is shareable and the back
 * button works. `parseArchiveFilters` is intentionally tolerant — invalid
 * values fall back to defaults rather than throwing.
 */

export interface ArchiveFilters {
  q: string;
  range: string;          // '1' | '7' | '30' | '90' | 'all'
  channel: ChannelType | '';
  decision: DecisionType | '';
  agent: AgentId | '';
  status: DisplayStatusType | '';
  flagSLA: boolean;
  flagEsc: boolean;
  flagUnauth: boolean;
  page: number;           // zero-based, matches Archive.jsx
}

export const DEFAULT_FILTERS: ArchiveFilters = {
  q: '',
  range: '30',
  channel: '',
  decision: '',
  agent: '',
  status: '',
  flagSLA: false,
  flagEsc: false,
  flagUnauth: false,
  page: 0,
};

const VALID_RANGE = new Set(['1', '7', '30', '90', 'all']);
const VALID_CHANNEL = new Set<ChannelType>(['voice', 'email', 'web']);
const VALID_DECISION = new Set<DecisionType>([
  'PROCESSING',
  'ELIGIBLE_FOR_DAMAGE_REVIEW',
  'NOT_ELIGIBLE',
  'HUMAN_REVIEW_REQUIRED',
  'WARRANTY_EXPIRED',
]);
const VALID_STATUS = new Set<DisplayStatusType>(['OPEN', 'CLOSED', 'REOPENED']);
const VALID_AGENT = new Set<AgentId>([
  'intake','shopify','warrreg','rules','summary','response','esc',
]);

type SearchSource = URLSearchParams | ReadonlyURLSearchParams;
type ReadonlyURLSearchParams = { get(name: string): string | null };

export function parseArchiveFilters(sp: SearchSource | null | undefined): ArchiveFilters {
  if (!sp) return { ...DEFAULT_FILTERS };

  const q          = sp.get('q')        ?? '';
  const rangeRaw   = sp.get('range')    ?? DEFAULT_FILTERS.range;
  const channelRaw = sp.get('channel')  ?? '';
  const decisionRaw= sp.get('decision') ?? '';
  const agentRaw   = sp.get('agent')    ?? '';
  const statusRaw  = sp.get('status')   ?? '';
  const flagSLA    = sp.get('sla')      === '1';
  const flagEsc    = sp.get('esc')      === '1';
  const flagUnauth = sp.get('unauth')   === '1';
  const pageRaw    = sp.get('page')     ?? '1';

  const page = Math.max(0, Number.parseInt(pageRaw, 10) - 1) || 0;

  return {
    q,
    range:    VALID_RANGE.has(rangeRaw)         ? rangeRaw                                  : DEFAULT_FILTERS.range,
    channel:  VALID_CHANNEL.has(channelRaw as ChannelType)   ? (channelRaw as ChannelType)   : '',
    decision: VALID_DECISION.has(decisionRaw as DecisionType) ? (decisionRaw as DecisionType) : '',
    agent:    VALID_AGENT.has(agentRaw as AgentId)           ? (agentRaw as AgentId)         : '',
    status:   VALID_STATUS.has(statusRaw as DisplayStatusType) ? (statusRaw as DisplayStatusType) : '',
    flagSLA,
    flagEsc,
    flagUnauth,
    page,
  };
}

/** Convert filters back into a URLSearchParams suitable for `?` of the URL. */
export function serializeArchiveFilters(f: ArchiveFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q)            sp.set('q', f.q);
  if (f.range && f.range !== DEFAULT_FILTERS.range) sp.set('range', f.range);
  if (f.channel)      sp.set('channel', f.channel);
  if (f.decision)     sp.set('decision', f.decision);
  if (f.agent)        sp.set('agent', f.agent);
  if (f.status)       sp.set('status', f.status);
  if (f.flagSLA)      sp.set('sla', '1');
  if (f.flagEsc)      sp.set('esc', '1');
  if (f.flagUnauth)   sp.set('unauth', '1');
  if (f.page > 0)     sp.set('page', String(f.page + 1));
  return sp;
}

/** Convert filters into the jsonb shape archive_aggregates expects. */
export function filtersToRpcJson(f: ArchiveFilters): Record<string, unknown> {
  return {
    q:           f.q || null,
    range_days:  f.range === 'all' ? null : Number(f.range),
    channel:     f.channel || null,
    decision:    f.decision || null,
    agent:       f.agent || null,
    status:      f.status || null,
    flag_sla:    f.flagSLA,
    flag_esc:    f.flagEsc,
    flag_unauth: f.flagUnauth,
  };
}
