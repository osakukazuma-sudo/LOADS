const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { harness, nodes } = require('./helpers/reaction-renderer.cjs');
function load(file, mocks) {
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => { if (!(name in mocks)) throw Error(`Unexpected import ${name}`); return mocks[name]; }, m, m.exports);
  return m.exports;
}
function surface(userId) {
  const post = { id: 'post', userId, authorName: 'Athlete', username: 'athlete', createdAt: '2026-10-20T00:00:00Z', durationSeconds: 60, totalSets: 1, totalVolume: 80, prCount: 0, exercises: [], caption: '', myReaction: 'yeah_buddy' };
  const WorkoutReactions = () => null;
  const mocks = {
    react: { ...React, useState: v => [v, () => {}] }, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { ...Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView', 'FlatList', 'Image'].map(n => [n, n])), StyleSheet: { create: v => v } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { useRouter: () => ({}), useLocalSearchParams: () => ({ id: 'post' }) },
    '../hooks/use-account-owner': { useAccountOwner: () => 'owner' },
    '../lib/setResult': {}, './workout-reactions': { WorkoutReactions },
    './delete-post-control': { DeletePostControl: () => null },
    './cardio-summary-card': { CardioSummaryCard: () => null },
    '../lib/cardio': { cardioTotals: () => ({ onlyCardio: false }) },
    '../lib/postDisplay': { postVolumeNote: () => '' },
    '../components/social-layout': { SocialLayout: 'SocialLayout', socialStyles: {} },
    '../hooks/use-visible-post': { useVisiblePost: () => ({ post, refresh: () => {}, loading: false }) },
    '../hooks/use-cloud-feed': { useCloudFeed: () => ({ posts: [post], pending: [], loading: false }) },
  };
  const { FeedPostCard } = load('src/components/feed-post-card.tsx', mocks);
  mocks['../components/feed-post-card'] = { FeedPostCard };
  const Home = load('src/app/index.tsx', mocks).default;
  const Feed = nodes(Home()).find(n => n.type === 'FlatList').props.renderItem({ item: post });
  const Detail = load('src/app/workout-post.tsx', mocks).default;
  const detailScreen = Detail();
  const detail = nodes(detailScreen.type(detailScreen.props)).find(n => n.type === FeedPostCard);
  const reaction = card => nodes(FeedPostCard.type(card.props)).find(n => n.type === WorkoutReactions);
  return { Feed, detail, reaction, post, FeedPostCard };
}
test('Feed and detail render the same reaction component with saved identity; own posts expose no picker', async () => {
  const s = surface('athlete');
  assert.equal(s.Feed.type, s.FeedPostCard); assert.equal(s.detail.type, s.FeedPostCard);
  for (const card of [s.Feed, s.detail]) {
    const picker = s.reaction(card);
    assert.deepEqual(picker.props, { owner: 'owner', postId: 'post', initial: 'yeah_buddy', initialFailure: undefined });
    const h = harness({ initial: picker.props.initial }); let tree = h.render();
    assert.deepEqual(h.selected(tree), ['⚡ YEAH BUDDY!!']);
    h.press(tree, 2); h.state.finish(); await h.flush(); tree = h.render();
    assert.equal(h.state.saved, 'slay'); assert.deepEqual(h.selected(tree), ['💅 SLAYYYYY!!']);
    h.press(tree, 2); h.state.finish(); await h.flush(); tree = h.render();
    assert.equal(h.state.saved, null); assert.deepEqual(h.selected(tree), []);
  }
  const own = surface('owner');
  assert.equal(own.reaction(own.Feed), undefined); assert.equal(own.reaction(own.detail), undefined);
});
