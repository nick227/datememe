const fs = require('fs');
const path = require('path');
const dir = '/home/administrator/web/datememe/apps/mobile/src/features/admin/screens';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx')).map(f => path.join(dir, f));

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const newContent = content.replace(/width="(wide|narrow)"/g, 'width="standard"');
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated ' + file);
  }
});
