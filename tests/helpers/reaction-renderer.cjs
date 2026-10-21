const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const ts = require('typescript');

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(text).join('');
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
function harness(options = {}) {
  const { initialFailure, production = false } = options;
  const initial = Object.hasOwn(options, 'initial') ? options.initial : null;
  const state = { saved: initial ?? null, writes: [], readError: null, writeError: null, commitOnError: false, finish: null, redraws: 0 };
  const slots = [], setters = [], memoCaches = [], effects = [];
  let hookIndex = 0, memoIndex = 0;
  const react = {
    useState(initializer) {
      const i = hookIndex++;
      if (!(i in slots)) slots[i] = typeof initializer === 'function' ? initializer() : initializer;
      setters[i] ??= value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; state.redraws++; };
      return [slots[i], setters[i]];
    },
    useReducer(reducer, initialValue) {
      const i = hookIndex++;
      if (!(i in slots)) slots[i] = initialValue;
      setters[i] ??= action => { slots[i] = reducer(slots[i], action); state.redraws++; };
      return [slots[i], setters[i]];
    },
    useEffect(effect, deps) {
      const i = hookIndex++;
      if (!slots[i] || deps.some((dep, j) => dep !== slots[i].deps[j])) effects.push(() => {
        slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() };
      });
    },
  };
  const compilerRuntime = { c(size) {
    const i = memoIndex++;
    return memoCaches[i] ??= Array(size).fill(Symbol.for('react.memo_cache_sentinel'));
  } };
  const native = { StyleSheet: { create: v => v }, Platform: { select: v => v.default },
    ...Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView'].map(n => [n, n])) };
  const mocks = { react, 'react/compiler-runtime': compilerRuntime, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': native, '@/global.css': {},
    '../lib/reactionApi': {
      readReaction: async () => { if (state.readError) throw state.readError; return state.saved; },
      writeReaction: async (_owner, _post, value) => {
        state.writes.push(value);
        await new Promise(resolve => { state.finish = resolve; });
        if (!state.writeError || state.commitOnError) state.saved = value;
        if (state.writeError) throw state.writeError;
      },
    },
  };
  const modules = new Map();
  function evaluate(file, code) {
    if (modules.has(file)) return modules.get(file);
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', code)(name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('.')) {
        const dep = path.resolve(path.dirname(file), name + '.ts');
        return evaluate(dep, ts.transpileModule(fs.readFileSync(dep, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
      }
      return require(name);
    }, mod, mod.exports);
    modules.set(file, mod.exports); return mod.exports;
  }
  const file = path.resolve('src/components/workout-reactions.tsx');
  const compiled = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: file, configFile: false, babelrc: false,
    plugins: [['babel-plugin-react-compiler', { target: '19', environment: { enableResetCacheOnSourceFileChanges: !production } }]],
    presets: [['babel-preset-expo', { 'react-compiler': false }]],
    caller: { name: 'metro', platform: 'ios', isDev: !production, supportsStaticESM: false },
  }).code;
  const { WorkoutReactions } = evaluate(file, compiled);
  const render = () => {
    hookIndex = 0; memoIndex = 0;
    const tree = WorkoutReactions({ owner: 'owner', postId: 'post', initial, initialFailure });
    while (effects.length) effects.shift()();
    return tree;
  };
  const buttons = tree => nodes(tree).filter(n => n.type === 'Pressable' && n.props.accessibilityState);
  const selected = tree => buttons(tree).filter(n => n.props.accessibilityState.selected).map(n => n.props.accessibilityLabel);
  const press = (tree, index) => {
    const button = buttons(tree)[index];
    if (!button.props.disabled) button.props.onPress();
  };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  return { state, compiled, render, buttons, selected, press, flush, nodes, text };
}
module.exports = { harness, nodes, text };
