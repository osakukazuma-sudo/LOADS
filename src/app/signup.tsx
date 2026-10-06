import {
    useState,
} from 'react';
import { authRedirectUrl } from '../lib/authRedirect';
  
  import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
  
  import {
    useRouter,
} from 'expo-router';
  
import { createAccount } from '../lib/signup';
  
  export default function SignupScreen() {
    const router =
      useRouter();
  
    const [
      username,
      setUsername,
    ] = useState('');
  
    const [
      displayName,
      setDisplayName,
    ] = useState('');
  
    const [
      email,
      setEmail,
    ] = useState('');
  
    const [
      password,
      setPassword,
    ] = useState('');
  
    const [
      loading,
      setLoading,
    ] = useState(false);
  
    const [message, setMessage] = useState('');
    const showMessage = (title: string, detail: string) => setMessage(`${title}: ${detail}`);

    const signup = async () => {
      if (loading) return;
      setMessage('');
      const cleanUsername =
        username
          .trim()
          .toLowerCase();
  
      const cleanDisplayName =
        displayName.trim();
  
      const cleanEmail =
        email
          .trim()
          .toLowerCase();
  
      if (
        !cleanUsername ||
        !cleanEmail ||
        !password
      ) {
        showMessage(
          'MISSING FIELDS',
          'Username, email and password are required.'
        );
  
        return;
      }
  
      if (
        cleanUsername.length <
        3
      ) {
        showMessage(
          'USERNAME',
          'Username must be at least 3 characters.'
        );
  
        return;
      }
  
      if (
        !/^[a-z0-9_]+$/.test(
          cleanUsername
        )
      ) {
        showMessage(
          'USERNAME',
          'Use only letters, numbers and underscores.'
        );
  
        return;
      }
  
      if (
        password.length <
        6
      ) {
        showMessage(
          'PASSWORD',
          'Password must be at least 6 characters.'
        );
  
        return;
      }
  
      try {
        setLoading(true);
  
        const {
          data,
          error,
        } =
          await createAccount({
            username: cleanUsername,
            displayName: cleanDisplayName,
            email: cleanEmail,
            password,
            emailRedirectTo: authRedirectUrl(),
          });
  
        if (error) {
          showMessage(
            'SIGN UP FAILED',
            error.message
          );
  
          return;
        }
  
        if (
          data?.session
        ) {
          router.replace(
            '/'
          );
  
          return;
        }
  
        showMessage(
          'CHECK YOUR EMAIL',
          'Open the confirmation email on this device to return to LOADS. If you confirmed on another device, use LOGIN below.'
        );
      } catch (error) {
        console.error(
          'Signup failed:',
          error
        );
  
        showMessage(
          'ERROR',
          'Could not create account.'
        );
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <KeyboardAvoidingView
          style={
            styles.container
          }
          behavior={
            Platform.OS ===
            'ios'
              ? 'padding'
              : undefined
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.content
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={
              false
            }
          >
            <View>
              <Text
                style={
                  styles.brand
                }
              >
                LOADS
              </Text>
  
              <Text
                style={
                  styles.tagline
                }
              >
                NO FLEX. JUST WORK.
              </Text>
            </View>
  
            <View
              style={
                styles.authArea
              }
            >
              <Text
                style={
                  styles.label
                }
              >
                JOIN THE WORK
              </Text>
  
              <Text
                style={
                  styles.title
                }
              >
                CREATE{'\n'}ACCOUNT
              </Text>
  
              <Text
                style={
                  styles.fieldLabel
                }
              >
                USERNAME
              </Text>
  
              <TextInput
                value={
                  username
                }
                onChangeText={
                  setUsername
                }
                placeholder="username"
                placeholderTextColor="#555"
                autoCapitalize="none"
                autoCorrect={
                  false
                }
                maxLength={24}
                style={
                  styles.input
                }
              />
  
              <Text
                style={
                  styles.fieldHint
                }
              >
                LETTERS, NUMBERS, AND _
              </Text>
  
              <Text
                style={
                  styles.fieldLabel
                }
              >
                DISPLAY NAME
              </Text>
  
              <TextInput
                value={
                  displayName
                }
                onChangeText={
                  setDisplayName
                }
                placeholder="Your name"
                placeholderTextColor="#555"
                maxLength={30}
                style={
                  styles.input
                }
              />
  
              <Text
                style={
                  styles.fieldLabel
                }
              >
                EMAIL
              </Text>
  
              <TextInput
                value={
                  email
                }
                onChangeText={
                  setEmail
                }
                placeholder="you@example.com"
                placeholderTextColor="#555"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={
                  false
                }
                style={
                  styles.input
                }
              />
  
              <Text
                style={
                  styles.fieldLabel
                }
              >
                PASSWORD
              </Text>
  
              <TextInput
                value={
                  password
                }
                onChangeText={
                  setPassword
                }
                placeholder="At least 6 characters"
                placeholderTextColor="#555"
                secureTextEntry
                autoCapitalize="none"
                style={
                  styles.input
                }
              />
  
              {!!message && (
                <Text accessibilityRole="alert" style={{ color: '#F5F5F2', marginTop: 12, lineHeight: 22 }}>
                  {message}
                </Text>
              )}

              <Pressable
                onPress={
                  signup
                }
                disabled={
                  loading
                }
                style={[
                  styles.primaryButton,
  
                  loading &&
                    styles.disabledButton,
                ]}
              >
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  {loading
                    ? 'CREATING...'
                    : 'CREATE ACCOUNT'}
                </Text>
              </Pressable>
  
              <View
                style={
                  styles.bottomRow
                }
              >
                <Text
                  style={
                    styles.bottomText
                  }
                >
                  ALREADY HAVE AN ACCOUNT?
                </Text>
  
                <Pressable
                  onPress={() =>
                    router.replace(
                      '/login'
                    )
                  }
                >
                  <Text
                    style={
                      styles.loginLink
                    }
                  >
                    LOGIN
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
  
  const styles =
    StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor:
          '#080808',
      },
  
      content: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 36,
        paddingBottom: 40,
      },
  
      brand: {
        color:
          '#F5F5F2',
        fontSize: 30,
        fontWeight:
          '900',
        letterSpacing: 3,
      },
  
      tagline: {
        marginTop: 4,
        color: '#555',
        fontSize: 8,
        fontWeight:
          '900',
        letterSpacing: 2,
      },
  
      authArea: {
        marginTop: 70,
      },
  
      label: {
        color:
          '#D9FF43',
        fontSize: 9,
        fontWeight:
          '900',
        letterSpacing: 2,
      },
  
      title: {
        marginTop: 5,
        marginBottom: 26,
        color:
          '#F5F5F2',
        fontSize: 43,
        lineHeight: 41,
        fontWeight:
          '900',
      },
  
      fieldLabel: {
        color: '#666',
        fontSize: 8,
        fontWeight:
          '900',
        letterSpacing: 1.4,
        marginBottom: 6,
        marginTop: 8,
      },
  
      fieldHint: {
        marginTop: -4,
        marginBottom: 8,
        color: '#3D3D3D',
        fontSize: 7,
        fontWeight:
          '900',
        letterSpacing: 1,
      },
  
      input: {
        backgroundColor:
          '#121212',
        borderWidth: 1,
        borderColor:
          '#292929',
        borderRadius: 9,
        color:
          '#F5F5F2',
        paddingHorizontal: 15,
        paddingVertical: 15,
        fontSize: 15,
        marginBottom: 8,
      },
  
      primaryButton: {
        marginTop: 17,
        backgroundColor:
          '#D9FF43',
        borderRadius: 9,
        paddingVertical: 17,
        alignItems:
          'center',
      },
  
      disabledButton: {
        opacity: 0.5,
      },
  
      primaryButtonText: {
        color:
          '#080808',
        fontWeight:
          '900',
        letterSpacing: 1.3,
      },
  
      bottomRow: {
        marginTop: 22,
        flexDirection:
          'row',
        flexWrap: 'wrap',
        justifyContent:
          'center',
        alignItems:
          'center',
        gap: 6,
      },
  
      bottomText: {
        color: '#555',
        fontSize: 8,
        fontWeight:
          '900',
      },
  
      loginLink: {
        color:
          '#D9FF43',
        fontSize: 8,
        fontWeight:
          '900',
      },
    });
