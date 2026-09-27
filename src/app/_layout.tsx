import {
  useEffect,
  useState,
} from 'react';

import {
  StyleSheet,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  Tabs,
  usePathname,
  useRouter,
} from 'expo-router';

import type {
  Session,
} from '@supabase/supabase-js';

import {
  supabase,
} from '../lib/supabase';

export default function RootLayout() {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const [
    session,
    setSession,
  ] =
    useState<Session | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    const loadSession =
      async () => {
        const {
          data,
        } =
          await supabase.auth.getSession();

        setSession(
          data.session
        );

        setLoading(
          false
        );
      };

    loadSession();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          nextSession
        ) => {
          setSession(
            nextSession
          );

          setLoading(
            false
          );
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    const isAuthScreen =
      pathname ===
        '/login' ||
      pathname ===
        '/signup';

    if (
      !session &&
      !isAuthScreen
    ) {
      router.replace(
        '/login'
      );

      return;
    }

    if (
      session &&
      isAuthScreen
    ) {
      router.replace('/');
    }
  }, [
    loading,
    session,
    pathname,
    router,
  ]);

  if (loading) {
    return (
      <View
        style={
          styles.loading
        }
      />
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown:
          false,

        tabBarStyle: {
          backgroundColor:
            '#0B0B0B',

          borderTopColor:
            '#1E1E1E',

          height: 88,
        },

        tabBarActiveTintColor:
          '#D9FF43',

        tabBarInactiveTintColor:
          '#666',

        tabBarLabelStyle: {
          fontSize: 10,

          fontWeight:
            '900',

          letterSpacing: 1.5,

          marginBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title:
            'HOME',

          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="home-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="workout"
        options={{
          title:
            'WORKOUT',

          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="barbell-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title:
            'HISTORY',

          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="stats-chart-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title:
            'PROFILE',

          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="person-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="post"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="history-detail"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="login"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="signup"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles =
  StyleSheet.create({
    loading: {
      flex: 1,
      backgroundColor:
        '#080808',
    },
  });