---
type: regex
pattern: '(message|messages)\W[^\n]{0,400}\bhooks?\b'
flags: i
target: trace
weight: 1
---
