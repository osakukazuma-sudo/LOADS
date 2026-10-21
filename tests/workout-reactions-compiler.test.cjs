const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { harness } = require('./helpers/reaction-renderer.cjs');

for (const production of [false, true]) {
  const mode = production ? 'production' : 'Expo development';
  test(`${mode}: compiled onPress updates pending UI, sends, changes, cancels and restores saved selection`, async () => {
    assert.equal(JSON.parse(fs.readFileSync('app.json', 'utf8')).expo.experiments.reactCompiler, true);
    const h = harness({ production });
    assert.match(h.compiled, /react\/compiler-runtime/);
    let tree = h.render();
    assert.deepEqual(h.buttons(tree).map(b => b.props.accessibilityLabel), ['🦍 BEAST!!', '⚡ YEAH BUDDY!!', '💅 SLAYYYYY!!', '🗣️ LIGHT WEIGHT BABY!!']);
    for (const index of [0, 1, 2, 3, 3]) {
      const before = tree;
      const value = ['beast', 'yeah_buddy', 'slay', 'light_weight'][index];
      const expected = h.state.saved === value ? null : value;
      h.press(tree, index);
      const writes = h.state.writes.length;
      tree = h.render();
      assert.ok(h.buttons(tree).every(b => b.props.disabled && b.props.accessibilityState.busy));
      assert.match(h.text(tree), /SENDING/);
      // Even an event handler captured before React's next render cannot double-submit.
      h.buttons(before)[(index + 1) % 4].props.onPress();
      assert.equal(h.state.writes.length, writes);
      const row = h.nodes(tree).find(n => n.type === 'ScrollView');
      assert.equal(row.props.horizontal, true); assert.notEqual(row.props.scrollEnabled, false);
      assert.equal(row.props.contentContainerStyle.flexWrap, 'nowrap');
      h.state.finish(); await h.flush(); tree = h.render();
      assert.equal(h.state.saved, expected);
      const selected = h.buttons(tree).filter(b => b.props.accessibilityState.selected);
      assert.equal(selected.length, expected ? 1 : 0);
      assert.ok(h.buttons(tree).every(b => !b.props.disabled && !b.props.accessibilityState.busy));
      assert.doesNotMatch(h.text(tree), /SENDING/);
      if (expected) {
        assert.equal(selected[0].props.accessibilityLabel, h.buttons(tree)[index].props.accessibilityLabel);
        assert.equal(selected[0].props.style[1].borderColor, '#D9FF43');
        assert.equal(selected[0].props.style[1].backgroundColor, undefined);
        assert.equal(selected[0].props.children.props.style[1].color, '#D9FF43');
      }
      const outsideButtons = tree.props.children.filter(n => n?.type !== 'ScrollView');
      assert.equal(h.text(outsideButtons), 'WORKOUT REACTIONS');
      const restored = harness({ initial: h.state.saved, production });
      assert.deepEqual(restored.selected(restored.render()), h.selected(tree));
    }
    assert.deepEqual(h.state.writes, ['beast', 'yeah_buddy', 'slay', 'light_weight', null]);
  });

  test(`${mode}: compiled error feedback reconciles rejected and committed writes and recovers unknown state`, async () => {
    const h = harness({ initial: 'beast', production });
    let tree = h.render();
    h.state.writeError = Error('response lost');
    h.press(tree, 2); h.state.finish(); await h.flush(); tree = h.render();
    assert.equal(h.state.saved, 'beast'); assert.deepEqual(h.selected(tree), ['🦍 BEAST!!']);
    assert.match(h.text(tree), /Could not confirm reaction/);
    assert.ok(h.nodes(tree).some(n => n.props?.accessibilityRole === 'alert'));
    h.state.commitOnError = true;
    h.press(tree, 2); h.state.finish(); await h.flush(); tree = h.render();
    assert.equal(h.state.saved, 'slay'); assert.deepEqual(h.selected(tree), ['💅 SLAYYYYY!!']);
    h.state.readError = Error('offline');
    h.press(tree, 1); h.state.finish(); await h.flush(); tree = h.render();
    assert.equal(h.state.saved, 'yeah_buddy'); assert.deepEqual(h.selected(tree), []);
    assert.ok(h.buttons(tree).every(b => b.props.disabled));
    assert.match(h.text(tree), /REFRESH REACTION/);
    h.state.readError = null;
    h.nodes(tree).find(n => n.type === 'Pressable' && h.text(n) === 'REFRESH REACTION').props.onPress();
    await h.flush(); tree = h.render();
    assert.deepEqual(h.selected(tree), ['⚡ YEAH BUDDY!!']);
    assert.ok(h.buttons(tree).every(b => !b.props.disabled));
    assert.doesNotMatch(h.text(tree), /Could not confirm reaction|REFRESH REACTION/);
    // Cancellation committed but response lost also reconciles to no highlight.
    h.press(tree, 1); h.state.finish(); await h.flush(); tree = h.render();
    assert.equal(h.state.saved, null); assert.deepEqual(h.selected(tree), []);
  });
}

test('compiled initial read failure refreshes into enabled restored selection instead of stale disabled JSX', async () => {
  const h = harness({ initial: undefined, initialFailure: { category: 'network', code: null } });
  let tree = h.render();
  assert.ok(h.buttons(tree).every(b => b.props.disabled));
  assert.match(h.text(tree), /Could not confirm reaction/);
  h.state.saved = 'slay';
  h.nodes(tree).find(n => n.type === 'Pressable' && h.text(n) === 'REFRESH REACTION').props.onPress();
  tree = h.render(); assert.match(h.text(tree), /LOADING/);
  await h.flush(); tree = h.render();
  assert.ok(h.buttons(tree).every(b => !b.props.disabled));
  assert.deepEqual(h.selected(tree), ['💅 SLAYYYYY!!']);
  assert.doesNotMatch(h.text(tree), /REFRESH REACTION|Could not confirm reaction|LOADING/);
});

test('compiled legacy Build 14 values remain replaceable without a fifth option or duplicate label', async () => {
  for (const initial of ['pain_zone', 'no_tomorrow', 'wagmi', 'built_different']) {
    const h = harness({ initial }); let tree = h.render();
    assert.equal(h.buttons(tree).length, 4); assert.deepEqual(h.selected(tree), []);
    h.press(tree, 2); h.state.finish(); await h.flush(); tree = h.render();
    assert.equal(h.state.saved, 'slay'); assert.deepEqual(h.selected(tree), ['💅 SLAYYYYY!!']);
    h.press(tree, 2); h.state.finish(); await h.flush(); tree = h.render();
    assert.equal(h.state.saved, null); assert.deepEqual(h.selected(tree), []);
  }
});
