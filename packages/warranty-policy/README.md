# warranty-policy

Deterministic warranty rule engine for JOOLA CS — **zero LLM**, pure Python policy logic.

## Why deterministic?

Warranty decisions must be reproducible, auditable, and citable to a specific
section of the JOOLA CS knowledge base. LLMs are non-deterministic and cannot
guarantee policy compliance. This package encodes every rule from
`docs/policies/cs-knowledge-base-v1.md` (version 1.0.0) as pure Python — no
network calls, no randomness, no `datetime.now()`.

Every `DecisionResult` carries a `citation` field pointing to the exact section
(e.g., `§1.7, §2.3`) so a CS Lead can verify the call against the policy doc.

## Install

```bash
pip install -e ".[dev]"
```

## Usage

```python
from datetime import date
from warranty_policy import (
    evaluate,
    ClaimInput,
    ProductType,
    OrderSource,
    Channel,
)

claim = ClaimInput(
    customer_country="US",
    is_original_purchaser=True,
    product_type=ProductType.PADDLE_NFC,
    order_source=OrderSource.JOOLA_DIRECT,
    purchase_date=date(2026, 3, 1),
    claim_date=date(2026, 5, 17),
    is_defective=True,
    nfc_registered=True,
    nfc_registration_date=date(2026, 3, 10),
    nfc_receipt_uploaded=True,
    nfc_receipt_approved=True,
)

result = evaluate(claim)
print(result.decision)        # Decision.ELIGIBLE_FOR_DAMAGE_REVIEW
print(result.reason_code)     # 'NFC_EXTENDED_WARRANTY'
print(result.citation)        # '§2.5'
print(result.policy_version)  # '1.0.0'
```

## Test

```bash
pytest
```

The test suite covers all 21 decision-tree priority cases plus NFC eligibility
math, warranty-matrix lookups for every product type, time-window edge cases,
and the version constant.

## Policy version

This package implements **policy version `1.0.0`** (effective 2026-05-17).
The constant is exported as `warranty_policy.__POLICY_VERSION__` and stamped on
every `DecisionResult`.

## How to bump the version

When `docs/policies/cs-knowledge-base-v1.md` changes:

1. Update the `Policy Version` line at the top of the knowledge-base doc.
2. Bump `version` in `pyproject.toml`.
3. Bump `__POLICY_VERSION__` in `warranty_policy/__init__.py`.
4. Update the default in `DecisionResult.policy_version` in `types.py`.
5. Update tests in `test_versioning.py` to assert the new version.
6. Add a CHANGELOG entry describing which §-sections changed and why.
7. Re-run `pytest` — every `DecisionResult` in tests will now stamp the new
   version, which is the intended audit signal.

Semver applies: rule-additions are MINOR, rule-removals or decision-flips are
MAJOR, citation-only or wording fixes are PATCH.
