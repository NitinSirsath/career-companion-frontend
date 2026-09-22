const fs = require('fs');

function fix(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/vi\.mocked\(api\.getApplicationActions\)\.mockResolvedValue\(\{ items: (\[.*?\]), metadata: \{ limit: 50, offset: 0, nextOffset: null \} \}\);/g, "vi.mocked(api.getApplicationActions).mockResolvedValue($1);");
  content = content.replace(/vi\.mocked\(api\.getApplicationEvents\)\.mockResolvedValue\(\{ items: (\[.*?\]), metadata: \{ limit: 50, offset: 0, nextOffset: null \} \}\);/g, "vi.mocked(api.getApplicationEvents).mockResolvedValue($1);");
  
  // also multiline
  content = content.replace(/vi\.mocked\(api\.getApplicationEvents\)\.mockResolvedValue\(\{ items: \[\n(.*?)\n\s*\], metadata: \{ limit: 50, offset: 0, nextOffset: null \} \}\);/gs, "vi.mocked(api.getApplicationEvents).mockResolvedValue([\n$1\n    ]);");
  
  content = content.replace(/vi\.mocked\(api\.getApplicationActions\)\.mockResolvedValue\(\{ items: \[\n(.*?)\n\s*\], metadata: \{ limit: 50, offset: 0, nextOffset: null \} \}\);/gs, "vi.mocked(api.getApplicationActions).mockResolvedValue([\n$1\n    ]);");

  fs.writeFileSync(file, content, 'utf8');
}

['src/tests/applications.test.tsx'].forEach(fix);
