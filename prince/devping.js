const { gmd } = require('../mayel');
const { respondDevPing } = require('../mayel/devPing');

gmd({
  pattern: 'devping',
  category: 'dev',
  description: 'Developer-only bot connection diagnostics',
}, respondDevPing);
