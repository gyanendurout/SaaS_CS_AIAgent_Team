# JOOLA CS — Voice Agent Local Knowledge Base

> This is the **rules-only** subset that Vapi can answer directly without calling our backend. It is a curated extract of `docs/policies/cs-knowledge-base-v1.md` v1.0.0. Update both files together when policy changes.

## RETURNS

- **Window:** 30 days from purchase, **JOOLA direct only**.
- **Who:** original purchaser only.
- **Condition:** new, unused, original packaging, all accessories.
  - Paddles: grip seal must be unbroken.
  - Apparel: tags attached, not worn or washed.
  - Rubbers, nets, balls: cannot return once opened (unless defective).
- **RMA required** — issued after a CS case is opened.
- **Refunds:** original payment method, 7-10 business days after item inspected.
- **Return shipping:** customer pays, unless JOOLA's error or product defect.

## ORDER CANCELLATION

- Orders **cannot** be cancelled or edited once placed. **No exceptions.**
- Customer waits for delivery, then starts return if eligible.

## NON-RETURNABLE (unless defective / JOOLA error)

Assembled rackets, tables, rubbers, blades, balls, covers, cases, grips, glues, cleaners, edge tapes.

## FINAL SALE / CLEARANCE

- Red-price / "Final Sale" / clearance items: **no return, exchange, refund, price match, price adjustment.**
- Exception: defective / damaged / wrong item, reported within **7 days of receipt**.

## WARRANTY — GENERAL

- Limited Manufacturers Warranty covers **defects in materials and workmanship**.
- Valid in **US, Puerto Rico, Canada only**.
- **Original purchaser only** — non-transferable.
- Liability is limited to **repair or replacement** at JOOLA's discretion.
- Replacements are **same-model only** (or comparable if discontinued). No upgrades.
- Replacement inherits **remaining** warranty from original purchase date — not a new warranty.

## WARRANTY EXCLUSIONS

Normal wear, improper use, negligence/abuse, transport damage (except refused freight), acts of nature, accidents, graphics fading, commercial/rental use, unauthorized modifications, unauthorized retailers, non-original purchaser.

## WARRANTY PERIODS — PICKLEBALL

| Product | Warranty | Max replacements |
|---|---|---|
| Paddles (standard) | 6 months | 2 |
| Paddles (NFC registered within 14 days) | 12 months | 3 |
| Nets | 1 year | — |
| Bags | 6 months | — |
| Eyewear | 1 year | 2 |
| Balls / Covers & Cases / Paddle Sets | **No warranty** | — |

## WARRANTY PERIODS — TABLE TENNIS

| Product | Warranty |
|---|---|
| Indoor / Outdoor Tables | 1 year |
| iPong Robots | 1 year |
| Recreational Rackets | 6 months |
| Table Covers / Nets / Bags | 6 months |
| Racket Sets | 3 months |
| Blades / Rubbers / Balls | 30 days |
| Customized Rackets | **No warranty** |

## NFC PADDLE EXTENDED WARRANTY

- Extends 6 months -> 12 months.
- **Window:** 14 days from purchase. **No exceptions** for late registration.
- Must be **JOOLA direct or authorized retailer** purchase.
- Register in **JOOLA Infinity App**: More > Product Settings > Product Registration.
- Receipt must be uploaded and **approved**.

## REPLACEMENT LIMITS

- Standard 6-month paddle warranty: **2 replacements**.
- NFC-registered 12-month warranty: **3 replacements**.
- Hit the limit -> no further warranty replacements (but escalate compelling cases).

## SHIPPING

- Ships to: all 50 US states + DC + Puerto Rico.
- Warranty valid: US, PR, Canada only.
- Two-day shipping is a **service, not a guaranteed date**. 1-2 business days processing first.
- Not eligible for two-day: tables, pro nets, large/wholesale, LTL freight orders.

## DAMAGED FREIGHT TABLES

- Customer **must refuse delivery** if damage is visible, or note damage on receipt before signing.
- Signed-for damage = may not be returnable -> **escalate** with `AMBIGUOUS_DAMAGE`, priority `high`.

## UNAUTHORIZED RETAILERS — FIRM RULE

- eBay, Facebook Marketplace, auction sites, other unauthorized sellers = **no coverage**, no exceptions.
- Recommend joola.com or authorized retailers going forward.

## AUTHORIZED THIRD-PARTY RETAILERS

- Returns: customer contacts **retailer first** within 30 days.
- Warranty: customer can contact JOOLA directly only if retailer can't resolve.

## INFINITY APP SUBSCRIPTION

- Premium: $19.99/month after 30-day free trial.
- Cancel at **infinity.joola.com/home** from a **web browser** (not mobile app).
- Previous charges **not refundable**.
- Customer can contact support before next billing date to prevent future charges.

## NEW PRODUCT DISCOUNTS

- Newly launched products: **no promotions, discounts, or upgrades for first 90 days** after launch.

## ESCALATION TRIGGERS (-> `escalate_to_human`)

- Replacement limit reached but compelling case (`REPLACEMENT_LIMIT_REACHED`)
- Disputed defect-vs-wear judgment (`AMBIGUOUS_DAMAGE`)
- Signed-for damaged freight (`AMBIGUOUS_DAMAGE`, high)
- Hostile customer / brand-risk language (`BRAND_RISK`, urgent)
- Safety concern / injury risk (`SAFETY`, urgent)
- Complex multi-item situation that doesn't fit policy cleanly

## HOURS

Monday-Friday, 8 AM - 5 PM EST. Closed major US holidays.

## PRO V PADDLE CATALOG

All 6 Pro V paddles: **$299.95** · **UPA-A + USAP certified** · **12mo warranty if NFC-registered <14d** · Textured Carbon Fiber · Feel-Tec grip · Ships in matte-black premium box with overgrip + edge tape.

| Paddle | SKU | Shape Class | Sizes | Signature Pro(s) | Color(s) |
|---|---|---|---|---|---|
| Perseus Pro V | 600558 | Elongated | 16mm, 14mm | Ben Johns, Simone Jardim | Blaze Red, Breeze Blue |
| Kosmos Pro V | 600576 | **Hybrid** | 16mm, 14mm | F. Staksrud (16mm), T. McGuffin (14mm) | Surge Green |
| Scorpeus Pro V | 600567 | **Standard** (widest, most forgiving) | 16mm, 14mm | Anna Bright, Collin Johns | JOOLA Yellow, Club Green |
| Hyperion Pro V | 600582 | Elongated (aero-curve) | 16mm, 14mm | Ben Johns | Bolt Blue |
| Agassi Pro V | 600591 | Elongated (tapered throat) | 16mm, 14mm | Andre Agassi (dev); Brooke Buckner, Kate Fahey | Royal Blue |
| Graf Pro V | 600594 | Elongated (Agassi shape) | **16mm only** | Steffi Graf (dev) | Seaside Green (exclusive) |

- **Weights:** 16mm = 8.1 oz (Scorpeus 8.2 oz); 14mm = 7.9 oz (Scorpeus 8.0 oz).
- **Grip options:** 4.250 in or 4.125 in (narrower). Graf = 4.125 only.
- **Shape classes:** Elongated = reach+power. Hybrid = versatile. Standard = forgiving/fast hands.
- **Shared tech:** KineticFrame *(patent-pending)*, Propulsion Core *(patented)*, Hyperfoam Edge Wall.
- **Agassi + Graf:** Part of **Agassi × JOOLA "Let's Play!"** donation program — buy one, JOOLA donates one.

### Player-fit cheatsheet
- Reach/power → **Perseus** or **Hyperion** (Hyperion for fast hands).
- All-court, versatile → **Kosmos** (hybrid).
- Control / forgiving / kitchen play → **Scorpeus**.
- Coming from tennis → **Agassi** (or **Graf** for narrower grip / smaller hands).
- Wants to support a charity → **Agassi** or **Graf**.
