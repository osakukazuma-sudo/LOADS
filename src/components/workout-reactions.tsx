import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createReactionController, reactionFailureMessage, WORKOUT_REACTIONS, type ReactionType, type ReactionFailure } from '../lib/workoutReactions';
import { readReaction, writeReaction } from '../lib/reactionApi';
import { Colors, Spacing } from '../constants/theme';

export function WorkoutReactions({ owner, postId, initial, initialFailure }: { owner: string; postId: string; initial?: ReactionType | null; initialFailure?: ReactionFailure }) {
  // React Compiler must observe a new snapshot, not the controller's mutable object.
  const [snapshot, setSnapshot] = useState<ReturnType<typeof createReactionController>['state'] | null>(null);
  const [controller] = useState(() => {
    const next = createReactionController(() => readReaction(owner, postId), value => writeReaction(owner, postId, value),
      () => setSnapshot({ ...next.state }), initial, initialFailure);
    if (initial === undefined) next.state.error = true;
    return next;
  });
  useEffect(() => { controller.activate(); return () => controller.dispose(); }, [controller]);
  const state = snapshot ?? controller.state;
  const button = (reaction: typeof WORKOUT_REACTIONS[number]) => <Pressable key={reaction.type}
    hitSlop={{ top: Spacing.two, bottom: Spacing.two, left: 0, right: 0 }}
    accessibilityRole="button" accessibilityLabel={`${reaction.emoji} ${reaction.label}`}
    accessibilityState={{ selected: state?.ready && state.value === reaction.type, disabled: !state?.ready || state.busy, busy: state?.busy }}
    disabled={!state?.ready || state.busy} style={[s.button, state?.ready && state.value === reaction.type && s.selected]}
    onPress={() => { void controller?.select(reaction.type); }}>
    <Text style={[s.text, state?.ready && state.value === reaction.type && s.selectedText]} numberOfLines={1}>{reaction.emoji} {reaction.label}</Text>
  </Pressable>;
  return <View style={s.root}>
    <Text style={s.label}>WORKOUT REACTIONS</Text>
    <ScrollView horizontal style={s.scroller} contentContainerStyle={s.row}
      showsHorizontalScrollIndicator={false} directionalLockEnabled nestedScrollEnabled
      bounces={false} alwaysBounceVertical={false}>
      {WORKOUT_REACTIONS.map(item => button(item))}
    </ScrollView>
    {(!state || state.busy) && <Text accessibilityLiveRegion="polite" style={s.label}>{state?.ready ? 'SENDING…' : 'LOADING…'}</Text>}
    {state?.error && <><Text accessibilityRole="alert" style={s.label}>{reactionFailureMessage(state.failure)}</Text><Pressable accessibilityRole="button" disabled={state.busy} onPress={() => void controller?.refresh()}><Text style={s.text}>REFRESH REACTION</Text></Pressable></>}
  </View>;
}
const s = StyleSheet.create({
  root: { marginTop: Spacing.two + Spacing.one, paddingTop: Spacing.two, borderTopWidth: 1, borderColor: '#262626', gap: Spacing.one },
  label: { color: Colors.dark.textSecondary, fontSize: 10, lineHeight: 14 },
  scroller: { flexGrow: 0, width: '100%' },
  row: { flexDirection: 'row', flexWrap: 'nowrap', gap: Spacing.two, paddingVertical: Spacing.two },
  button: { flexShrink: 0, minWidth: 48, minHeight: Spacing.five, justifyContent: 'center', alignItems: 'center', borderRadius: 999, paddingHorizontal: Spacing.two + Spacing.half, paddingVertical: Spacing.one, borderWidth: 1, borderColor: '#444', backgroundColor: Colors.dark.backgroundElement },
  selected: { borderColor: Colors.dark.accent },
  selectedText: { color: Colors.dark.accent },
  text: { color: Colors.dark.textSecondary, fontSize: 12, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
});
