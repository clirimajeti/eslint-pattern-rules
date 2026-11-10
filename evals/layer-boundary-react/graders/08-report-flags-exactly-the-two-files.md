---
type: llm
focus: last_message
weight: 1
---
PASS if the final report says the rule, run with the recommended configuration over the original src, flagged UserCard.tsx (a relative import) and OrderBadge.tsx (an @/ alias import) and nothing else (not the hooks, not OrderRow.tsx's type-only import), and that the rule's tests passed when run.
FAIL if it says the rule or its tests could not be run, or lists other files.
