# Bot maintenance
- Add isolated commands as standalone prince plugins and use central isDevs identity verification for developer-only access, never owner/sudo privileges, to preserve unrelated command behavior.
- Run node --test tests/devping.test.js after changing developer ping permissions or replies.
