/**
 * Domain types — mirror the Supabase schema rows we read/write from this API.
 * These do NOT replace generated supabase types (we can add those later);
 * they're hand-written contracts for the handful of tables we touch.
 */

export type Channel = 'voice' | 'email' | 'web';

export type Decision =
  | 'PROCESSING'
  | 'ELIGIBLE_FOR_DAMAGE_REVIEW'
  | 'NOT_ELIGIBLE'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'WARRANTY_EXPIRED';

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

export type DisplayStatus = 'OPEN' | 'CLOSED' | 'REOPENED';

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

export type ProductType =
  | 'PADDLE_STANDARD'
  | 'PADDLE_NFC'
  | 'PICKLEBALL_NETS'
  | 'PICKLEBALL_BALLS'
  | 'COVERS_CASES'
  | 'BAGS'
  | 'EYEWEAR'
  | 'PADDLE_SETS'
  | 'TT_INDOOR_TABLE'
  | 'TT_OUTDOOR_TABLE'
  | 'TT_CUSTOMIZED_RACKET'
  | 'TT_RACKET_SET'
  | 'TT_RECREATIONAL_RACKET'
  | 'IPONG_ROBOT'
  | 'TT_BLADES'
  | 'TT_RUBBERS'
  | 'TT_BALLS'
  | 'TT_TABLE_COVERS'
  | 'TT_NETS'
  | 'TT_BAGS'
  | 'APPAREL'
  | 'GRIPS'
  | 'GLUES'
  | 'CLEANERS'
  | 'EDGE_TAPES'
  | 'OTHER';

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  country: string;
  phone: string | null;
  created_at: string;
}

export interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string;
  product_name: string;
  product_sku: string;
  product_type: ProductType;
  purchase_date: string; // ISO date
  source: OrderSource;
  authorized: boolean;
  created_at: string;
}

export interface RegistrationRow {
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

export interface ClaimRow {
  id: string;
  customer_id: string;
  order_id: string | null;
  channel: Channel;
  issue: string;
  status_detail: ClaimStatusDetail;
  display_status: DisplayStatus;
  decision: Decision;
  reason_code: string | null;
  citation: string | null;
  policy_version: string;
  primary_agent_id: string | null;
  sentiment: number | null;
  stage: string;
  created_at: string;
  closed_at: string | null;
  handle_seconds: number | null;
  reopened_at: string | null;
  reopen_category: ReopenCategory | null;
  reopen_note: string | null;
}

export interface DraftRow {
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

export interface EscalationRow {
  id: string; // = claim_id
  priority: EscalationPriority;
  reason: EscalationReason;
  wait_minutes: number;
  summary: string;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
}

export interface CaseEventRow {
  id: string;
  claim_id: string;
  event_type: string;
  actor_type: ActorType;
  actor_id: string | null;
  payload: Record<string, unknown>;
  policy_version: string;
  created_at: string;
}
