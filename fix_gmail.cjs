const fs = require('fs');
let content = fs.readFileSync('src/tests/gmail.test.tsx', 'utf8');
content = content.replace(/total: 0,\n      limit: 50,\n      offset: 0/g, "metadata: { limit: 50, offset: 0, nextOffset: null }");
fs.writeFileSync('src/tests/gmail.test.tsx', content, 'utf8');
