# Bot maintenance
- Keep universal developer ping in the shared mayel/devPing handler, dispatched at command-listener entry before any mode/prefix reads and reused by the existing plugin; authorize through verified sender PN/LID mappings, never owner/sudo or raw LID digits, and deduplicate per socket/chat/message to avoid reply loops. This keeps diagnostics independent of normal commands and avoids unnecessary metadata lookups for already verified senders.
- Run node --test tests/devping.test.js after changing developer ping permissions or replies.
