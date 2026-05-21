/**
 * Manually-typed Database interface mirroring migrations/0001_initial_schema.sql
 * + migrations/0003_rpc_functions.sql. When supabase gen types is wired up in
 * CI, this file will be regenerated — until then the types here are the
 * canonical contract the rest of the dashboard reads against.
 */

export type ChannelType = 'voice' | 'email' | 'web';

export type DecisionType =
  | 'PROCESSING'
  | 'ELIGIBLE_FOR_DAMAGE_REVIEW'
  | 'NOT_ELIGIBLE'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'WARRANTY_EXPIRED';

export type DisplayStatusType = 'OPEN' | 'CLOSED' | 'REOPENED';

export type ClaimStatusDetail =
  | 'NEW'
  | 'AWAITING_VERIFICATION'
  | 'IN_RULE_EVAL'
  | 'AWAITING_PHOTOS'
  | 'AWAITING_RECEIPT'
  | 'DRAFT_PENDING_APPROVAL'
  | 'DRAFT_APPROVED'
  | 'AWAITING_CUSTOMER_REPLY'
  | 'AWAITING_DAMAGE_REVIEW'
  | 'VOID_AND_BREAK_PENDING'
  | 'VOID_AND_BREAK_COMPLETED'
  | 'REPLACEMENT_APPROVED'
  | 'REPLACEMENT_SHIPPED'
  | 'REPLACEMENT_DELIVERED'
  | 'ESCALATED'
  | 'ON_HOLD'
  | 'CLOSED_RESOLVED'
  | 'CLOSED_DECLINED'
  | 'CLOSED_EXPIRED'
  | 'CLOSED_NO_RESPONSE'
  | 'REOPENED'
  | 'CANCELLED';

export type AgentStateType = 'idle' | 'busy' | 'blocked' | 'error';

export type EscalationPriority = 'urgent' | 'high' | 'norm';

export type EscalationReason =
  | 'REPLACEMENT_LIMIT_REACHED'
  | 'OUTSIDE_REGION'
  | 'DISPUTED_SELLER'
  | 'AMBIGUOUS_DAMAGE'
  | 'BRAND_RISK'
  | 'SAFETY';

export type ReopenCategory =
  | 'customer_disputed'
  | 'damage_worsened'
  | 'new_info'
  | 'other';

export type ActorType = 'AI' | 'CS_LEAD' | 'CUSTOMER' | 'SYSTEM';

export type OrderSource =
  | 'JOOLA_DIRECT'
  | 'AUTHORIZED_RETAILER'
  | 'EBAY'
  | 'FACEBOOK_MARKETPLACE'
  | 'AUCTION_SITE'
  | 'UNKNOWN_ONLINE'
  | 'OTHER';

export type AgentId =
  | 'intake'
  | 'shopify'
  | 'warrreg'
  | 'rules'
  | 'summary'
  | 'response'
  | 'esc';

/* ---------- Tables ---------- */

export interface Agent {
  id: AgentId;
  glyph: string;
  name: string;
  role: string;
  created_at: string;
}

export interface AgentState {
  agent_id: AgentId;
  state: AgentStateType;
  queue_depth: number;
  handled_today: number;
  avg_ms: number;
  load_pct: number;
  current_task_for: string | null;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  country: string;
  phone: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  product_name: string;
  product_sku: string;
  product_type: string;
  purchase_date: string;
  source: OrderSource;
  authorized: boolean;
  created_at: string;
}

export interface Registration {
  id: string;
  order_id: string;
  registered: boolean;
  nfc_id: string | null;
  registered_at: string | null;
  within_window: boolean;
  receipt_uploaded: boolean;
  receipt_approved: boolean;
  approved_at: string | null;
  created_at: string;
}

export interface Claim {
  id: string;
  customer_id: string;
  order_id: string | null;
  channel: ChannelType;
  issue: string;
  status_detail: ClaimStatusDetail;
  display_status: DisplayStatusType;
  decision: DecisionType;
  reason_code: string | null;
  citation: string | null;
  policy_version: string;
  primary_agent_id: AgentId | null;
  sentiment: number | null;
  stage: string;
  created_at: string;
  closed_at: string | null;
  handle_seconds: number | null;
  reopened_at: string | null;
  reopen_category: ReopenCategory | null;
  reopen_note: string | null;
}

export interface Transcript {
  id: number;
  claim_id: string;
  line_index: number;
  who: 'CUSTOMER' | 'AI';
  txt: string;
  created_at: string;
}

export interface EmailRow {
  id: string;
  claim_id: string;
  direction: 'inbound' | 'outbound';
  from_addr: string;
  to_addr: string;
  subject: string;
  body: string;
  sent_at: string | null;
  created_at: string;
}

export interface Draft {
  id: string;
  claim_id: string;
  voice_text: string | null;
  email_subject: string | null;
  email_body: string | null;
  internal_summary: string | null;
  status: 'pending_approval' | 'approved' | 'edited' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface Escalation {
  id: string;            // matches claim id
  priority: EscalationPriority;
  reason: EscalationReason;
  wait_minutes: number;
  summary: string;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
}

export interface CaseEvent {
  id: string;
  claim_id: string;
  event_type: string;
  actor_type: ActorType;
  actor_id: string | null;
  payload: Record<string, unknown>;
  policy_version: string;
  created_at: string;
}

/* ---------- Views ---------- */

export interface DashboardKpi {
  calls_today: number;
  emails_today: number;
  web_forms_today: number;
  open_claims: number;
  auto_resolve_pct: number;
  avg_handle_seconds: number;
  escalations_count: number;
  sla_breach_count: number;
}

export interface PipelineStageRow {
  stage: 'intake' | 'verify' | 'rules' | 'draft' | 'closed';
  count: number;
  stuck_count: number;
}

export interface DecisionMixRow {
  decision: DecisionType;
  count: number;
}

/* ---------- RPC return shapes ---------- */

export interface ArchiveRow {
  id: string;
  created_at: string;
  closed_at: string | null;
  handle_seconds: number | null;
  status: DisplayStatusType;
  channel: ChannelType;
  customer_name: string;
  customer_email: string;
  customer_country: string;
  order_number: string | null;
  order_product: string | null;
  order_source: OrderSource | null;
  order_authorized: boolean;
  issue: string;
  decision: DecisionType;
  reason_code: string | null;
  primary_agent_id: AgentId | null;
  stage: string;
  total_count: number;
}

export interface ArchiveAggregates {
  daily_volume: Array<{ date: string; count: number }>;
  decision_mix: Partial<Record<DecisionType, number>>;
  agent_leaderboard: Array<{ agent_id: AgentId; name: string; count: number }>;
  channel_mix: Partial<Record<ChannelType, number>>;
  top_issues: Array<{ issue: string; count: number }>;
}

/* ---------- Database root (subset used by the dashboard) ---------- */

export interface Database {
  public: {
    Tables: {
      agents: { Row: Agent; Insert: never; Update: never };
      agent_states: { Row: AgentState; Insert: never; Update: Partial<AgentState> };
      customers: { Row: Customer; Insert: Omit<Customer, 'id' | 'created_at'>; Update: Partial<Customer> };
      orders: { Row: Order; Insert: Omit<Order, 'id' | 'created_at' | 'authorized'>; Update: Partial<Order> };
      registrations: { Row: Registration; Insert: Omit<Registration, 'id' | 'created_at' | 'within_window'>; Update: Partial<Registration> };
      claims: { Row: Claim; Insert: Omit<Claim, 'id' | 'created_at' | 'display_status' | 'handle_seconds'>; Update: Partial<Claim> };
      transcripts: { Row: Transcript; Insert: Omit<Transcript, 'id' | 'created_at'>; Update: Partial<Transcript> };
      emails: { Row: EmailRow; Insert: Omit<EmailRow, 'id' | 'created_at'>; Update: Partial<EmailRow> };
      drafts: { Row: Draft; Insert: Omit<Draft, 'id' | 'created_at'>; Update: Partial<Draft> };
      escalations: { Row: Escalation; Insert: Omit<Escalation, 'created_at'>; Update: Partial<Escalation> };
      case_events: { Row: CaseEvent; Insert: Omit<CaseEvent, 'id' | 'created_at'>; Update: never };
    };
    Views: {
      dashboard_kpi: { Row: DashboardKpi };
      claim_pipeline_summary: { Row: PipelineStageRow };
      decision_mix_today: { Row: DecisionMixRow };
    };
    Functions: {
      archive_query: { Args: never; Returns: ArchiveRow[] };
      archive_aggregates: { Args: { p_filters: Record<string, unknown> }; Returns: ArchiveAggregates };
      case_count_filtered: { Args: { p_filters: Record<string, unknown> }; Returns: number };
    };
    Enums: {
      channel_type: ChannelType;
      decision_type: DecisionType;
      display_status_type: DisplayStatusType;
      agent_state_type: AgentStateType;
      escalation_priority: EscalationPriority;
      escalation_reason: EscalationReason;
      reopen_category: ReopenCategory;
    };
  };
}
