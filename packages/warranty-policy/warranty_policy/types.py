"""Pydantic v2 types for the JOOLA warranty rule engine.

All enums mirror the Postgres enums declared in
``migrations/0001_initial_schema.sql`` so a ``DecisionResult`` can be
persisted to the ``claims`` table without translation.
"""

from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class Decision(str, Enum):
    """§2.8 / schema ``decision_type``: terminal classification of a claim."""

    PROCESSING = "PROCESSING"
    ELIGIBLE_FOR_DAMAGE_REVIEW = "ELIGIBLE_FOR_DAMAGE_REVIEW"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"
    HUMAN_REVIEW_REQUIRED = "HUMAN_REVIEW_REQUIRED"
    WARRANTY_EXPIRED = "WARRANTY_EXPIRED"


class EscalationReason(str, Enum):
    """§5.2 / schema ``escalation_reason``: routing tag for the human queue."""

    REPLACEMENT_LIMIT_REACHED = "REPLACEMENT_LIMIT_REACHED"
    OUTSIDE_REGION = "OUTSIDE_REGION"
    DISPUTED_SELLER = "DISPUTED_SELLER"
    AMBIGUOUS_DAMAGE = "AMBIGUOUS_DAMAGE"
    BRAND_RISK = "BRAND_RISK"
    SAFETY = "SAFETY"


class ProductType(str, Enum):
    """§2.4 / schema ``product_type``: every SKU family JOOLA sells."""

    # Pickleball — §2.4
    PADDLE_STANDARD = "PADDLE_STANDARD"
    PADDLE_NFC = "PADDLE_NFC"
    PICKLEBALL_NETS = "PICKLEBALL_NETS"
    PICKLEBALL_BALLS = "PICKLEBALL_BALLS"
    COVERS_CASES = "COVERS_CASES"
    BAGS = "BAGS"
    EYEWEAR = "EYEWEAR"
    PADDLE_SETS = "PADDLE_SETS"
    # Table tennis — §2.4
    TT_INDOOR_TABLE = "TT_INDOOR_TABLE"
    TT_OUTDOOR_TABLE = "TT_OUTDOOR_TABLE"
    TT_CUSTOMIZED_RACKET = "TT_CUSTOMIZED_RACKET"
    TT_RACKET_SET = "TT_RACKET_SET"
    TT_RECREATIONAL_RACKET = "TT_RECREATIONAL_RACKET"
    IPONG_ROBOT = "IPONG_ROBOT"
    TT_BLADES = "TT_BLADES"
    TT_RUBBERS = "TT_RUBBERS"
    TT_BALLS = "TT_BALLS"
    TT_TABLE_COVERS = "TT_TABLE_COVERS"
    TT_NETS = "TT_NETS"
    TT_BAGS = "TT_BAGS"
    # Apparel & accessories — §1.9
    APPAREL = "APPAREL"
    GRIPS = "GRIPS"
    GLUES = "GLUES"
    CLEANERS = "CLEANERS"
    EDGE_TAPES = "EDGE_TAPES"
    OTHER = "OTHER"


class OrderSource(str, Enum):
    """§1.7 / §2.9 / schema ``order_source``: where the customer bought it."""

    JOOLA_DIRECT = "JOOLA_DIRECT"
    AUTHORIZED_RETAILER = "AUTHORIZED_RETAILER"
    EBAY = "EBAY"
    FACEBOOK_MARKETPLACE = "FACEBOOK_MARKETPLACE"
    AUCTION_SITE = "AUCTION_SITE"
    UNKNOWN_ONLINE = "UNKNOWN_ONLINE"
    OTHER = "OTHER"


class Channel(str, Enum):
    """Schema ``channel_type``: how the customer reached us."""

    voice = "voice"
    email = "email"
    web = "web"


class ClaimInput(BaseModel):
    """Normalized claim payload — the single input to :func:`evaluate`.

    The intake agent is responsible for producing this shape. Every field
    that downstream rules consult is explicit — there are no hidden
    look-ups.
    """

    model_config = ConfigDict(strict=True, extra="forbid")

    customer_country: str = Field(
        ...,
        description="ISO-2 country code. §2.1 / §4.13: warranty valid only in US, CA, PR.",
        min_length=2,
        max_length=2,
    )
    is_original_purchaser: bool = Field(
        ..., description="§1.1, §2.1, §4.4: only the original purchaser may claim."
    )
    product_type: ProductType
    order_source: OrderSource
    purchase_date: date = Field(..., description="§2.1: warranty clock starts here.")
    claim_date: date = Field(..., description="When the customer reports — never datetime.now().")

    is_defective: bool = Field(..., description="§2.2: defect in materials/workmanship.")
    is_wrong_item_shipped: bool = Field(default=False, description="§4.9: JOOLA error.")
    is_safety_concern: bool = Field(default=False, description="§5.2: always escalate.")
    is_damaged_in_freight: bool = Field(default=False, description="§2.7: freight rule.")
    freight_was_signed_for: bool | None = Field(
        default=None, description="§2.7: signed → BRAND_RISK; refused → review."
    )
    is_ambiguous_damage: bool = Field(default=False, description="§5.2: human eyes.")

    is_final_sale: bool = Field(default=False, description="§1.8: clearance / red price.")
    received_date: date | None = Field(
        default=None, description="§1.8: 7-day window for final-sale defects."
    )
    is_opened: bool = Field(
        default=False,
        description="§1.2, §4.7: rubbers/nets/balls cannot return if opened (unless defective).",
    )

    # NFC extended-warranty (§2.5) — only meaningful for PADDLE_NFC.
    nfc_registered: bool = Field(default=False, description="§2.5 cond. 1+3.")
    nfc_registration_date: date | None = Field(
        default=None, description="§2.5 cond. 3: within 14 days of purchase."
    )
    nfc_receipt_uploaded: bool = Field(default=False, description="§2.5 cond. 4.")
    nfc_receipt_approved: bool = Field(default=False, description="§2.5 cond. 5.")

    replacements_so_far: int = Field(
        default=0, ge=0, description="§2.8 step 5 / §4.3: enforces the replacement cap."
    )

    is_cancellation_request: bool = Field(default=False, description="§1.5, §4.10: hard no.")
    wants_different_model: bool = Field(default=False, description="§4.2: same-model only.")
    wants_shipping_refund: bool = Field(default=False, description="§1.3, §4.6: defect/error only.")


class DecisionResult(BaseModel):
    """Output of :func:`evaluate` — auditable, citable, persistable."""

    model_config = ConfigDict(strict=True, extra="forbid")

    decision: Decision
    reason_code: str = Field(
        ...,
        description="Machine-readable code (e.g. 'UNAUTHORIZED_SELLER').",
        min_length=1,
    )
    citation: str = Field(
        ..., description="One or more §-sections from the knowledge base.", min_length=1
    )
    policy_version: str = "1.0.0"
    escalation_reason: EscalationReason | None = None
    notes: str | None = Field(default=None, description="Internal note for the CS Lead.")
