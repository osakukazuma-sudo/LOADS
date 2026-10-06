import * as Linking from 'expo-linking';
import { supabase } from './supabase';

export function authRedirectUrl() {
  const generated = Linking.createURL('auth/callback', { scheme: 'loads' });
  // Development builds can carry a Metro hostUri. Native callbacks must still
  // use the same stable route as TestFlight; Expo Go/Web keep their own URL.
  return generated.startsWith('loads:') ? 'loads://auth/callback' : generated;
}

function destination(raw: string) {
  try {
    const url = new URL(raw);
    if (url.username || url.password) throw new Error();
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, '');
  } catch {
    throw new Error('This is not a valid LOADS confirmation link.');
  }
}

// Keep one in-flight/result promise: auth events can remount the route while a
// single-use code is being exchanged. Never log the URL or credentials.
let last: { url: string; result: Promise<void> } | undefined;
export function completeAuthRedirect(raw: string): Promise<void> {
  if (last?.url === raw) return last.result;
  const result = complete(raw);
  last = { url: raw, result };
  return result;
}

async function complete(raw: string) {
  if (destination(raw) !== destination(authRedirectUrl())) {
    throw new Error('This is not a LOADS confirmation link.');
  }
  const url = new URL(raw);
  const params = new URLSearchParams(url.search);
  const fragment = new URLSearchParams(url.hash.slice(1));
  for (const [key, value] of fragment) params.set(key, value);
  if (params.has('error') || params.has('error_code')) {
    throw new Error('This confirmation link has expired or is invalid. Return to LOGIN, or request a new confirmation email.');
  }
  const code = params.get('code');
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if ((!code && !(access_token && refresh_token)) || (code && (access_token || refresh_token))) {
    throw new Error('No valid confirmation was received. If your email is confirmed, use LOGIN.');
  }
  const current = await supabase.auth.getSession();
  if (current.error) throw new Error('Could not read your session. Restart LOADS and use LOGIN.');
  // Do not silently replace another account (and its active local operations).
  if (current.data.session) throw new Error('An account is already signed in. Use HOME, or log out before opening a new confirmation link.');
  const response = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.setSession({ access_token: access_token!, refresh_token: refresh_token! });
  if (response.error || !response.data.session) {
    throw new Error('Could not finish sign-in. Open the link on the device where you registered. If your email is confirmed, use LOGIN with your password.');
  }
}
