---
type: regex
pattern: 'message\W{1,8}[^\n]{0,300}(readSetting|writeSetting|storage\.ts)'
flags: i
target: trace
weight: 1
---
