---
tags: [skill-creator]
max_turns: 60
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

In shop-web our convention is that React components never talk to the api/ modules directly, they always go through a hook in hooks/. A couple of components slipped through. Write an eslint rule for this. We'll probably reuse it in our other apps which have a different folder layout, so keep that in mind. I'm not around to answer questions, so go with your recommendations and write down what you decided and why.

Input files: shop-web
