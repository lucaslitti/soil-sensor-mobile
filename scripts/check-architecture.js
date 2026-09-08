const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'src');
const violations = [];

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(target);
    return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

for (const file of files(root)) {
  const relative = path.relative(root, file);
  const source = fs.readFileSync(file, 'utf8');
  if (relative.startsWith('domain' + path.sep) && /react-native|react-native-ble-plx|zustand|sqlite|mmkv|navigation/.test(source)) {
    violations.push(`${relative}: domain imports a platform or presentation dependency`);
  }
  if (relative.startsWith('interface' + path.sep) && /features\/|react-native-ble-plx|BleManager|gattRepository|smartPotRepository/.test(source)) {
    violations.push(`${relative}: presentation imports a legacy feature or BLE repository`);
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('Architecture import rules passed');
