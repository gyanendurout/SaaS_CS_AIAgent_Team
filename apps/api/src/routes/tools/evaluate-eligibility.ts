/**
 * Vapi tool: evaluate_eligibility
 *
 * Validates the Vapi-shape body (the schema the assistant prompt describes),
 * then transforms it into the Python `warranty_policy.ClaimInput` shape and
 * forwards to the ai-agents service. When an order_id / order_number /
 * customer_email is supplied we enrich missing fields (purchase_date, source,
 * country, NFC registration) from Supabase so the decision is grounded in
 * the seeded order data instead of whatever the model guessed.
 *
 * Returns:
 *   { decision, reason_code, citation, policy_version, escalation_reason? }
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { env } from '../../env.js';
import { UpstreamError } from '../../lib/errors.js';
import type {
  CustomerRow,
  OrderRow,
  RegistrationRow,
} from '../../types/domain.js';
import { EvaluateEligibilityInput } from '../../types/tools.js';

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/tools/evaluate_eligibility', async (req, reply) => {
    const parsed = EvaluateEligibilityInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        details: parsed.error.flatten(),
      });
    }
    const log = req.log.child({ tool: 'evaluate_eligibility' });

    const claimInput = await buildClaimInput(app, parsed.data);

    try {
      const result = await app.aiAgents.evaluateEligibility(claimInput);
      log.info(
        { decision: result.decision, reason: result.reason_code },
        'evaluate_eligibility',
      );
      return reply.send({
        decision: result.decision,
        reason_code: result.reason_code,
        citation: result.citation,
        policy_version: result.policy_version ?? env.POLICY_VERSION,
        escalation_reason: result.escalation_reason ?? null,
      });
    } catch (err) {
      if (err instanceof UpstreamError) {
        log.error({ err: err.message }, 'eligibility upstream failed');
        return reply.code(503).send({
          error: 'upstream_unavailable',
          message: err.message,
        });
      }
      throw err;
    }
  });
};

export default route;

// =============================================================================
// Transform
// =============================================================================

type OrderWithCustomer = OrderRow & { customers: Pick<CustomerRow, 'country'> | null };

async function buildClaimInput(
  app: FastifyInstance,
  input: ReturnType<typeof EvaluateEligibilityInput.parse>,
): Promise<Record<string, unknown>> {
  const today = new Date().toISOString().slice(0, 10);

  let order: OrderWithCustomer | null = null;
  let registration: RegistrationRow | null = null;

  // 1. Resolve order (id, number, or via email -> most recent order).
  if (input.order_id) {
    const { data } = await app.supabase
      .from('orders')
      .select('*, customers(country)')
      .eq('id', input.order_id)
      .maybeSingle();
    order = (data as OrderWithCustomer | null) ?? null;
  } else if (input.order_number) {
    const normalised = input.order_number.replace(/^JL[-_ ]?/i, '');
    const { data } = await app.supabase
      .from('orders')
      .select('*, customers(country)')
      .or(`order_number.eq.${normalised},order_number.eq.${input.order_number}`)
      .limit(1)
      .maybeSingle();
    order = (data as OrderWithCustomer | null) ?? null;
  } else if (input.customer_email) {
    const { data: cust } = await app.supabase
      .from('customers')
      .select('id, country')
      .ilike('email', input.customer_email)
      .limit(1)
      .maybeSingle();
    if (cust) {
      const { data: o } = await app.supabase
        .from('orders')
        .select('*, customers(country)')
        .eq('customer_id', (cust as Pick<CustomerRow, 'id'>).id)
        .order('purchase_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      order = (o as OrderWithCustomer | null) ?? null;
    }
  }

  // 2. Resolve registration when we have an order.
  if (order?.id) {
    const { data } = await app.supabase
      .from('registrations')
      .select('*')
      .eq('order_id', order.id)
      .maybeSingle();
    registration = (data as RegistrationRow | null) ?? null;
  }

  // 3. Compose fields, preferring caller-supplied values, then DB, then defaults.
  const purchaseDate = input.purchase_date ?? order?.purchase_date ?? today;
  const orderSource = input.order_source ?? order?.source ?? 'UNKNOWN_ONLINE';

  // Country: caller's `OTHER` should be treated as outside-region (§4.13). The
  // Python `customer_country` is a 2-char ISO code; encode "outside" as 'XX'
  // so the rule engine's "in US/CA/PR?" check fails cleanly.
  const dbCountry = order?.customers?.country?.toUpperCase() ?? null;
  let customerCountry: string;
  if (input.country === 'OTHER') {
    customerCountry = 'XX';
  } else if (input.country) {
    customerCountry = input.country;
  } else if (dbCountry) {
    customerCountry = dbCountry.length > 2 ? dbCountry.slice(0, 2) : dbCountry;
  } else {
    customerCountry = 'US';
  }

  // NFC fields: callers may pass nfc_registered explicitly; otherwise read from DB.
  const nfcRegistered =
    input.nfc_registered ?? registration?.registered ?? false;
  const nfcRegistrationDate = registration?.registered_at
    ? String(registration.registered_at).slice(0, 10)
    : null;
  const nfcReceiptUploaded = registration?.receipt_uploaded ?? false;
  const nfcReceiptApproved = registration?.receipt_approved ?? false;

  // received_date: if Vapi said "reported within 7 days", encode as received today.
  // Used by §1.8 final-sale defect window — irrelevant otherwise.
  const receivedDate = input.reported_within_7_days === true ? today : null;

  return {
    customer_country: customerCountry,
    is_original_purchaser: input.is_original_purchaser,
    product_type: input.product_type,
    order_source: orderSource,
    purchase_date: purchaseDate,
    claim_date: today,
    is_defective: input.is_defective,
    is_wrong_item_shipped: false,
    is_safety_concern: false,
    is_damaged_in_freight: false,
    freight_was_signed_for: input.signed_for_damaged_freight ?? null,
    is_ambiguous_damage: false,
    is_final_sale: false,
    received_date: receivedDate,
    is_opened: false,
    nfc_registered: nfcRegistered,
    nfc_registration_date: nfcRegistrationDate,
    nfc_receipt_uploaded: nfcReceiptUploaded,
    nfc_receipt_approved: nfcReceiptApproved,
    replacements_so_far: input.replacements_used ?? 0,
    is_cancellation_request: false,
    wants_different_model: false,
    wants_shipping_refund: false,
  };
}
