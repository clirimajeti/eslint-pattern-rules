---
type: regex
pattern: 'message\W{1,8}[^\n]{0,300}ADR[ -]?0*7\b'
flags: i
target: trace
weight: 1
---
