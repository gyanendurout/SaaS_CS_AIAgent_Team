/**
 * Vapi tool: check_warranty_registration
 *
 * Returns the NFC registration status:
 *   { registered, nfc_id, registered_at, within_window,
 *     receipt_uploaded, receipt_approved }
 *
 * Accepts order_id, order_number, or nfc_id. Returns a "not registered"
 * shape rather than null when the lookup resolves but no registration exists,
 * so the model gets a usable boolean.
 */

import type { FastifyPluginAsync } from 'fastify';

import { CheckRegistrationInput } from '../../types/tools.js';
import type { OrderRow, RegistrationRow } from '../../types/domain.js';

interface RegistrationDTO {
  registered: boolean;
  nfc_id: string | null;
  registered_at: string | null;
  within_window: boolean;
  receipt_uploaded: boolean;
  receipt_approved: boolean;
  order_id: string | null;
}

const NOT_REGISTERED = (orderId: string | null): RegistrationDTO => ({
  registered: false,
  nfc_id: null,
  registered_at: null,
  within_window: false,
  receipt_uploaded: false,
  receipt_approved: false,
  order_id: orderId,
});

const route: FastifyPluginAsync = async (app) => {
  app.post('/api/tools/check_warranty_registration', async (req, reply) => {
    const parsed = CheckRegistrationInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        details: parsed.error.flatten(),
      });
    }
    const input = parsed.data;
    const log = req.log.child({ tool: 'check_warranty_registration' });

    let orderId = input.order_id ?? null;

    // Resolve order_id from order_number if needed.
    if (!orderId && input.order_number) {
      const normalised = input.order_number.replace(/^JL[-_ ]?/i, '');
      const { data, error } = await app.supabase
        .from('orders')
        .select('id')
        .or(`order_number.eq.${normalised},order_number.eq.${input.order_number}`)
        .limit(1)
        .maybeSingle();
      if (error) {
        log.error({ err: error.message }, 'order-by-number lookup failed');
        return reply.code(500).send({ error: 'lookup_failed' });
      }
      orderId = (data as Pick<OrderRow, 'id'> | null)?.id ?? null;
    }

    let registration: RegistrationRow | null = null;
    if (orderId) {
      const { data, error } = await app.supabase
        .from('registrations')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      if (error) {
        log.error({ err: error.message }, 'registration lookup failed');
        return reply.code(500).send({ error: 'lookup_failed' });
      }
      registration = (data as RegistrationRow | null) ?? null;
    } else if (input.nfc_id) {
      const { data, error } = await app.supabase
        .from('registrations')
        .select('*')
        .eq('nfc_id', input.nfc_id)
        .limit(1)
        .maybeSingle();
      if (error) {
        log.error({ err: error.message }, 'registration-by-nfc lookup failed');
        return reply.code(500).send({ error: 'lookup_failed' });
      }
      registration = (data as RegistrationRow | null) ?? null;
      orderId = registration?.order_id ?? null;
    }

    if (!registration) {
      log.info({ orderId, nfc: input.nfc_id ?? null }, 'no registration');
      return reply.send(NOT_REGISTERED(orderId));
    }

    const dto: RegistrationDTO = {
      registered: registration.registered,
      nfc_id: registration.nfc_id,
      registered_at: registration.registered_at,
      within_window: registration.within_window,
      receipt_uploaded: registration.receipt_uploaded,
      receipt_approved: registration.receipt_approved,
      order_id: registration.order_id,
    };

    log.info({ orderId, within_window: dto.within_window }, 'registration found');
    return reply.send(dto);
  });
};

export default route;
