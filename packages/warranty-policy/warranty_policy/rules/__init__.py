"""Rule modules for the JOOLA warranty policy engine.

Each module encapsulates one slice of the knowledge base. The master
:func:`warranty_policy.rules.decision_tree.evaluate` composes them in a
fixed priority order — see that file for the rule numbering.
"""
