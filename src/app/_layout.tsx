import { NotificationGate } from '../components/notification-gate';
import { AccountOwnerContext } from '../hooks/use-account-owner';
import { AccountDeletionGate } from '../components/account-deletion-gate';
import { UserDataGate } from '../components/user-data-gate';
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
} from 'expo-router';

import type {
  Session,
} from '@supabase/supabase-js';

import {
  supabase,
} from '../lib/supabase';

export default function RootLayout() {
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
    let alive = true;
    let authEventReceived = false;
    const loadSession =
      async () => {
        const {
          data,
        } =
          await supabase.auth.getSession();

        // A callback may establish a session while the initial read is pending.
        if (!alive || authEventReceived) return;

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
          if (!alive) return;
          authEventReceived = true;
          setSession(
            nextSession
          );

          setLoading(
            false
          );
        }
      );

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);


  if (loading) {
    return (
      <View
        style={
          styles.loading
        }
      />
    );
  }

  const tabs = (
    <Tabs key={session?.user.id ?? "signed-out"}
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
      <Tabs.Protected guard={!!session}>
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="tagged" options={{ href: null }} />
      <Tabs.Screen name="people" options={{ href: null }} />
      <Tabs.Screen name="athlete" options={{ href: null }} />
      <Tabs.Screen name="connections" options={{ href: null }} />
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

      </Tabs.Protected>
      <Tabs.Protected guard={!session}>
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
      </Tabs.Protected>
      <Tabs.Screen name="auth/callback" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  );
  return <AccountDeletionGate><AccountOwnerContext.Provider value={session?.user.id ?? ""}>
    {session ? <UserDataGate key={session.user.id} userId={session.user.id} label={session.user.email ?? session.user.id}><NotificationGate owner={session.user.id} />{tabs}</UserDataGate> : tabs}
  </AccountOwnerContext.Provider></AccountDeletionGate>;
}

const styles =
  StyleSheet.create({
    loading: {
      flex: 1,
      backgroundColor:
        '#080808',
    },
  });
