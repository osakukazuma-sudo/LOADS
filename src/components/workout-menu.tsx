import { useState } from 'react';
import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { workoutFinishAlert } from '../lib/workoutFinishAlert';

export function WorkoutMenu({ disabled, onDiscard }: { disabled: boolean; onDiscard: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const confirmDiscard = () => {
    setOpen(false);
    workoutFinishAlert('DISCARD WORKOUT?', 'このワークアウトの記録を破棄します。\nこの操作は取り消せません。', [
      { text: 'KEEP WORKING', style: 'cancel' },
      { text: 'DISCARD', style: 'destructive', onPress: () => { void onDiscard(); } },
    ]);
  };
  const showMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({
        options: ['DISCARD WORKOUT', 'CANCEL'], destructiveButtonIndex: 0, cancelButtonIndex: 1,
        userInterfaceStyle: 'dark', tintColor: '#C7C7C7',
      }, index => { if (index === 0) confirmDiscard(); });
    } else setOpen(true);
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Workout menu" disabled={disabled} onPress={showMenu} style={styles.button}>
      <Text style={styles.dots}>···</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close workout menu">
        <View style={styles.menu}>
          <Pressable accessibilityRole="button" disabled={disabled} onPress={confirmDiscard} style={styles.action}>
            <Text style={styles.destructive}>DISCARD WORKOUT</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.action}><Text style={styles.cancel}>CANCEL</Text></Pressable>
        </View>
      </Pressable>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dots: { color: '#C7C7C7', fontSize: 28, fontWeight: '800' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000099', padding: 20 },
  menu: { backgroundColor: '#1A1A1A', borderRadius: 12, paddingVertical: 6 },
  action: { padding: 18, alignItems: 'center' },
  destructive: { color: '#D99B9B', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  cancel: { color: '#C7C7C7', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
