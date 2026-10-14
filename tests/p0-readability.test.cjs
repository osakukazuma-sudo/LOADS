const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function styles(file) {
  const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'StyleSheet.create') {
      result = new Function(`return (${node.arguments[0].getText(tree)})`)();
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return result;
}
function luminance(hex) {
  hex = hex.slice(1);
  if (hex.length === 3) hex = [...hex].map(c => c + c).join('');
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
test('key secondary labels remain readable against their actual dark surfaces', () => {
  const checks = [
    ['src/app/workout.tsx', 'templateHint', 'container'],
    ['src/app/workout.tsx', 'overviewLabel', 'exerciseCard'],
    ['src/app/workout.tsx', 'lastSessionSub', 'lastSessionCard'],
    ['src/app/workout.tsx', 'volumeLabel', 'volumeContainer'],
    ['src/app/workout.tsx', 'setNoteToggleText', 'exerciseCard'],
    ['src/app/workout.tsx', 'noteSavedLabel', 'exerciseCard'],
    ['src/app/workout.tsx', 'deleteSetText', 'exerciseCard'],
    ['src/app/workout.tsx', 'focusOptionDescription', 'focusOption'],
    ['src/app/history-detail.tsx', 'setNoteLabel', 'setNote'],
    ['src/components/feed-post-card.tsx', 'label', 'card'],
    ['src/components/feed-post-card.tsx', 'badgeText', 'badge'],
    ['src/components/cardio-exercise-card.tsx', 'label', 'card'],
  ];
  for (const [file, label, surface] of checks) {
    const sheet = styles(file);
    const a = luminance(sheet[label].color), b = luminance(sheet[surface].backgroundColor);
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `${file}: ${label} contrast`);
    assert.ok(sheet[label].fontSize >= 11, `${file}: ${label} size`);
  }
});
