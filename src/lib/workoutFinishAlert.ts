import { Alert, Platform } from 'react-native';

// The finish flow uses either an informational alert or CANCEL/FINISH actions.
// react-native-web's Alert.alert is a no-op, including its action callbacks.
export const workoutFinishAlert: typeof Alert.alert = (title, message, buttons, options) => {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons, options);
    return;
  }
  const text = [title, message].filter(Boolean).join('\n\n');
  if (!buttons?.length) {
    window.alert(text);
    return;
  }
  const action = window.confirm(text)
    ? buttons.find(button => button.style !== 'cancel')
    : buttons.find(button => button.style === 'cancel');
  action?.onPress?.();
};
