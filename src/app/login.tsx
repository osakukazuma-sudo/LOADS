import {
    useState,
} from 'react';
  
  import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
  
  import {
    useRouter,
} from 'expo-router';
  
  import {
    supabase,
} from '../lib/supabase';
  
  export default function LoginScreen() {
    const router =
      useRouter();
  
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
  
    const login = async () => {
      const cleanEmail =
        email
          .trim()
          .toLowerCase();
  
      if (
        !cleanEmail ||
        !password
      ) {
        Alert.alert(
          'MISSING FIELDS',
          'Enter your email and password.'
        );
  
        return;
      }
  
      try {
        setLoading(true);
  
        const {
          error,
        } =
          await supabase.auth.signInWithPassword(
            {
              email:
                cleanEmail,
  
              password,
            }
          );
  
        if (error) {
          Alert.alert(
            'LOGIN FAILED',
            error.message
          );
  
          return;
        }
  
        router.replace('/');
      } catch (error) {
        console.error(
          'Login failed:',
          error
        );
  
        Alert.alert(
          'ERROR',
          'Could not log in.'
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
          <View
            style={
              styles.content
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
                WELCOME BACK
              </Text>
  
              <Text
                style={
                  styles.title
                }
              >
                LOGIN
              </Text>
  
              <TextInput
                value={
                  email
                }
                onChangeText={
                  setEmail
                }
                placeholder="Email"
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
  
              <TextInput
                value={
                  password
                }
                onChangeText={
                  setPassword
                }
                placeholder="Password"
                placeholderTextColor="#555"
                secureTextEntry
                autoCapitalize="none"
                style={
                  styles.input
                }
              />
  
              <Pressable
                onPress={
                  login
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
                    ? 'LOGGING IN...'
                    : 'LOGIN'}
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
                  NEW TO LOADS?
                </Text>
  
                <Pressable
                  onPress={() =>
                    router.push(
                      '/signup'
                    )
                  }
                >
                  <Text
                    style={
                      styles.signupLink
                    }
                  >
                    CREATE ACCOUNT
                  </Text>
                </Pressable>
              </View>
            </View>
  
            <Text
              style={
                styles.footer
              }
            >
              PUT THE WORK ON THE BOARD.
            </Text>
          </View>
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
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 36,
        paddingBottom: 30,
        justifyContent:
          'space-between',
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
        width: '100%',
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
        marginBottom: 24,
        color:
          '#F5F5F2',
        fontSize: 44,
        fontWeight:
          '900',
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
        marginBottom: 10,
      },
  
      primaryButton: {
        marginTop: 8,
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
        letterSpacing: 1.5,
      },
  
      bottomRow: {
        marginTop: 22,
        flexDirection:
          'row',
        justifyContent:
          'center',
        alignItems:
          'center',
        gap: 7,
      },
  
      bottomText: {
        color: '#555',
        fontSize: 9,
        fontWeight:
          '900',
      },
  
      signupLink: {
        color:
          '#D9FF43',
        fontSize: 9,
        fontWeight:
          '900',
      },
  
      footer: {
        textAlign:
          'center',
        color: '#303030',
        fontSize: 8,
        fontWeight:
          '900',
        letterSpacing: 1.5,
      },
    });