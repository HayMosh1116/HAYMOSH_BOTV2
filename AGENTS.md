# Bot maintenance
- Keep universal developer ping in the shared mayel/devPing handler, dispatched before mode/prefix command gates and reused by the existing plugin; authorize through verified sender PN/LID mappings, never owner/sudo or raw LID digits, and deduplicate per socket/chat/message to avoid reply loops.
- Run node --test tests/devping.test.js after changing developer ping permissions or replies.
