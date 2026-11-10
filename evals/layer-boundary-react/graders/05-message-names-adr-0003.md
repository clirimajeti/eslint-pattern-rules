---
type: regex
pattern: '(message|messages)\W[^\n]{0,400}ADR[ -]?0*3\b'
flags: i
target: trace
weight: 1
---
