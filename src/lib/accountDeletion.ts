import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { beginSignOut } from './accountActivity';
import { supabase } from './supabase';
import { flushLocalWrites } from './userLocalData';
import { clearDeletedAccountData } from './accountDeletionLocalData';

const key = '@loads/account-deletion/v1';
export type DeletionReceipt = { userId: string; email: string; receipt: string; submitted: boolean };
export type DeletionStatus = { status: 'not_started' | 'pending' | 'processing' | 'failed' | 'completed'; completed_at: string | null; failure_code: string | null };
const listeners = new Set<() => void>();
export function subscribeDeletion(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function changed() { listeners.forEach(listener => listener()); }
export async function readDeletionReceipt(): Promise<DeletionReceipt | null> {
  const value = await AsyncStorage.getItem(key);
  if (!value) return null;
  const record = JSON.parse(value);
  if (!/^[a-f0-9-]{36}$/i.test(record.userId) || !/^[a-f0-9]{64}$/.test(record.receipt) || typeof record.email !== 'string' || typeof record.submitted !== 'boolean') throw new Error('Could not read deletion recovery information.');
  return record;
}

export async function requestAccountDeletion(password: string) {
  const release = beginSignOut({ name: 'delete-account', source: 'accountDeletion.requestAccountDeletion' });
  try {
    release.setPhase?.('flush-local-writes');
    await flushLocalWrites();
    release.setPhase?.('auth-get-user');
    const session = await supabase.auth.getUser();
    if (session.error || !session.data.user?.email) throw new Error('Sign in again before deleting your account.');
    const owner = session.data.user;
    release.setPhase?.('read-deletion-receipt');
    let record = await readDeletionReceipt();
    if (record && record.userId !== owner.id) throw new Error('Resolve the previous account deletion first.');
    if (!record) {
      release.setPhase?.('prepare-delete-account-function');
      const prepared = await supabase.functions.invoke('delete-account', { body: { action: 'prepare' }, timeout: 20_000 });
      if (prepared.error || !/^[a-f0-9]{64}$/.test(prepared.data?.receipt ?? '')) throw new Error('Could not prepare account deletion. Nothing has been requested.');
      record = { userId: owner.id, email: owner.email!, receipt: prepared.data.receipt, submitted: false };
      release.setPhase?.('save-prepared-receipt');
      await AsyncStorage.setItem(key, JSON.stringify(record));
    }
    // Persist BEFORE request: unknown response must be checked after restart.
    record = { ...record, submitted: true };
    release.setPhase?.('save-submitted-receipt');
    await AsyncStorage.setItem(key, JSON.stringify(record));
    changed();
    release.setPhase?.('request-delete-account-function');
    const response = await supabase.functions.invoke('delete-account', { body: { action: 'request', password, receipt: record.receipt }, timeout: 20_000 });
    if (response.error || response.data?.accepted !== true) throw new Error('Request result is unconfirmed. Use CHECK STATUS before retrying.');
  } finally { release(); changed(); }
}

const statusChecks = new Map<string, { next: number; delay: number; busy: boolean }>();
export function deletionStatusWaitSeconds(record: DeletionReceipt): number {
  return Math.max(0, Math.ceil(((statusChecks.get(record.receipt)?.next ?? 0) - Date.now()) / 1000));
}
export async function checkAccountDeletion(record: DeletionReceipt): Promise<DeletionStatus | null> {
  const state = statusChecks.get(record.receipt) ?? { next: 0, delay: 5, busy: false };
  if (state.busy) throw new Error('Status check is already running.');
  if (Date.now() < state.next) throw new Error(`Check again in ${Math.ceil((state.next - Date.now()) / 1000)} seconds.`);
  statusChecks.set(record.receipt, state);
  state.busy = true;
  let retryAfter = 0;
  let terminal = false;
  try {
  // Independent of expired/revoked Auth sessions. Never send the receipt in a URL.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let result: Response;
  try { result = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/account-deletion-status`, {
    method: 'POST', headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_KEY!, 'Content-Type': 'application/json' }, body: JSON.stringify({ receipt: record.receipt }),
    signal: controller.signal,
  }); } finally { clearTimeout(timeout); }
  if (result.status === 429) {
    retryAfter = Number(result.headers.get('Retry-After')) || 0;
    throw new Error('Too many status checks. Wait before checking again. Your local data has been kept.');
  }
  if (result.status === 404) { terminal = true; return null; } // Not evidence of completion.
  if (!result.ok) throw new Error('Could not check status. Your local data has been kept.');
  const data = await result.json();
  if (!['not_started','pending','processing','failed','completed'].includes(data.status)) throw new Error('Unexpected status. Your local data has been kept.');
  terminal = !['pending', 'processing'].includes(data.status);
  return data;
  } finally {
    state.next = Date.now() + Math.max(terminal ? 5 : state.delay, retryAfter) * 1000;
    state.delay = terminal ? 5 : Math.min(30, state.delay * 2);
    state.busy = false;
  }
}

export async function retryAccountDeletion(record: DeletionReceipt, password: string) {
  const verifier = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const result = await verifier.auth.signInWithPassword({ email: record.email, password });
  if (result.error || result.data.user?.id !== record.userId) throw new Error('Could not verify this account. Check your password.');
  try {
    const response = await verifier.functions.invoke('delete-account', { body: { action: 'request', password, receipt: record.receipt }, timeout: 20_000 });
    if (response.error || response.data?.accepted !== true) throw new Error('Request result is unconfirmed. Check status again.');
  } finally { await verifier.auth.signOut({ scope: 'local' }); }
}

export async function finishLocalAccountDeletion(record: DeletionReceipt) {
  const current = await readDeletionReceipt();
  if (current?.userId !== record.userId || current.receipt !== record.receipt) throw new Error('Deletion recovery changed. Reload before clearing local data.');
  await clearDeletedAccountData(record.userId);
  const session = await supabase.auth.getSession();
  if (session.error) throw new Error('Local data cleared. Retry to finish signing out.');
  if (session.data.session?.user.id === record.userId) {
    const result = await supabase.auth.signOut({ scope: 'local' });
    if (result.error) throw new Error('Local data cleared. Retry to finish signing out.');
  }
  await AsyncStorage.removeItem(key);
  statusChecks.delete(record.receipt);
  changed();
}

export async function cancelUnstartedDeletion(record: DeletionReceipt) {
  const result = await supabase.functions.invoke('delete-account', { body: { action: 'cancel', receipt: record.receipt }, timeout: 20_000 });
  if (result.error || result.data?.cancelled !== true) throw new Error('Could not cancel. Check deletion status again.');
  // Server serialized cancellation against acceptance. No local workouts are removed.
  await AsyncStorage.removeItem(key); statusChecks.delete(record.receipt); changed();
}
