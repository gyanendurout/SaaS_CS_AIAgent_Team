/**
 * Zod schemas for Vapi tool inputs.
 *
 * MUST mirror packages/vapi-assistant-config/tools/*.json exactly. If those
 * JSON schemas change, update here too — keep them in lockstep.
 */

import { z } from 'zod';

// --- Shared enums ----------------------------------------------------------

export const ProductTypeEnum = z.enum([
  'PADDLE_STANDARD',
  'PADDLE_NFC',
  'PICKLEBALL_NETS',
  'PICKLEBALL_BALLS',
  'COVERS_CASES',
  'BAGS',
  'EYEWEAR',
  'PADDLE_SETS',
  'TT_INDOOR_TABLE',
  'TT_OUTDOOR_TABLE',
  'TT_CUSTOMIZED_RACKET',
  'TT_RACKET_SET',
  'TT_RECREATIONAL_RACKET',
  'IPONG_ROBOT',
  'TT_BLADES',
  'TT_RUBBERS',
  'TT_BALLS',
  'TT_TABLE_COVERS',
  'TT_NETS',
  'TT_BAGS',
  'APPAREL',
  'GRIPS',
  'GLUES',
  'CLEANERS',
  'EDGE_TAPES',
  'OTHER',
]);

export const OrderSourceEnum = z.enum([
  'JOOLA_DIRECT',
  'AUTHORIZED_RETAILER',
  'EBAY',
  'FACEBOOK_MARKETPLACE',
  'AUCTION_SITE',
  'UNKNOWN_ONLINE',
  'OTHER',
]);

export const DecisionEnum = z.enum([
  'PROCESSING',
  'ELIGIBLE_FOR_DAMAGE_REVIEW',
  'NOT_ELIGIBLE',
  'HUMAN_REVIEW_REQUIRED',
  'WARRANTY_EXPIRED',
]);

export const EscalationReasonEnum = z.enum([
  'REPLACEMENT_LIMIT_REACHED',
  'OUTSIDE_REGION',
  'DISPUTED_SELLER',
  'AMBIGUOUS_DAMAGE',
  'BRAND_RISK',
  'SAFETY',
]);

export const EscalationPriorityEnum = z.enum(['urgent', 'high', 'norm']);

export const CountryEnum = z.enum(['US', 'CA', 'PR', 'OTHER']);

// --- shared field rules ---------------------------------------------------
// Order numbers go into Supabase filters (`.ilike`, `.or(...)`): only letters,
// digits, spaces, '#' and '-' are allowed, so '%', '_', ',', '.', '(' can never
// turn a lookup into a wildcard or extra filter (QA 2026-11-14, D1 critical).
export const OrderNumberField = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9# -]+$/, 'order number: letters, digits, spaces, # and - only');
export const EmailField = z.string().trim().max(254).email();
export const NfcIdField = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9:_-]+$/, 'nfc_id: letters, digits, :, _ and - only');
export const IsoDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'not a real calendar date');
const IssueField = z.string().trim().min(1).max(4000);

// --- lookup_order ----------------------------------------------------------

export const LookupOrderInput = z
  .object({
    order_number: OrderNumberField.optional(),
    customer_email: EmailField.optional(),
  })
  .refine((d) => Boolean(d.order_number || d.customer_email), {
    message: 'Provide order_number or customer_email',
  });
export type LookupOrderInput = z.infer<typeof LookupOrderInput>;

// --- check_warranty_registration ------------------------------------------

export const CheckRegistrationInput = z
  .object({
    order_id: z.string().uuid().optional(),
    order_number: OrderNumberField.optional(),
    nfc_id: NfcIdField.optional(),
  })
  .refine((d) => Boolean(d.order_id || d.order_number || d.nfc_id), {
    message: 'Provide order_id, order_number, or nfc_id',
  });
export type CheckRegistrationInput = z.infer<typeof CheckRegistrationInput>;

// --- evaluate_eligibility -------------------------------------------------

export const EvaluateEligibilityInput = z.object({
  order_id: z.string().uuid().optional(),
  order_number: OrderNumberField.optional(),
  customer_email: EmailField.optional(),
  product_type: ProductTypeEnum,
  order_source: OrderSourceEnum.optional(),
  purchase_date: IsoDateField.optional(),
  issue: IssueField,
  is_defective: z.boolean(),
  is_original_purchaser: z.boolean(),
  country: CountryEnum.optional(),
  nfc_registered: z.boolean().optional(),
  replacements_used: z.number().int().min(0).optional(),
  signed_for_damaged_freight: z.boolean().optional(),
  reported_within_7_days: z.boolean().optional(),
});
export type EvaluateEligibilityInput = z.infer<typeof EvaluateEligibilityInput>;

// --- create_claim ----------------------------------------------------------

export const CreateClaimInput = z.object({
  customer_id: z.string().uuid().optional(),
  customer_email: EmailField.optional(),
  customer_name: z.string().trim().min(1).max(200).optional(),
  order_id: z.string().uuid().optional(),
  order_number: OrderNumberField.optional(),
  channel: z.enum(['voice']).default('voice'),
  issue: IssueField,
  is_defective: z.boolean(),
  decision: DecisionEnum.optional(),
  reason_code: z.string().max(100).optional(),
  citation: z.string().max(500).optional(),
  sentiment: z.number().min(0).max(1).optional(),
});
export type CreateClaimInput = z.infer<typeof CreateClaimInput>;

// --- escalate_to_human ----------------------------------------------------

export const EscalateToHumanInput = z.object({
  claim_id: z.string().regex(/^WC-\d{5,}$/, 'Expected WC-XXXXX'),
  reason: EscalationReasonEnum,
  priority: EscalationPriorityEnum,
  summary: z.string().min(1),
});
export type EscalateToHumanInput = z.infer<typeof EscalateToHumanInput>;

// --- search_knowledge -----------------------------------------------------

export const SearchKnowledgeInput = z.object({
  query: z.string().trim().min(1).max(500),
});
export type SearchKnowledgeInput = z.infer<typeof SearchKnowledgeInput>;

// --- search_products ------------------------------------------------------

export const SearchProductsInput = z.object({
  query: z.string().trim().min(1).max(200),
});
export type SearchProductsInput = z.infer<typeof SearchProductsInput>;

/** get_order_status — order number OR email, either is enough (owner decision 2026-11-16). */
export const GetOrderStatusInput = z.object({
  order_number: z.string().trim().max(40).optional(),
  email: z.string().trim().max(254).optional(),
});
export type GetOrderStatusInput = z.infer<typeof GetOrderStatusInput>;
