import { supabase } from './supabase';
import { beginAccountOperation } from './accountActivity';

async function assertOwner(owner: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== owner) throw new Error('Account changed.');
}
export async function reactionNotificationsEnabled(owner: string) {
  await assertOwner(owner);
  const result = await supabase.from('notification_preferences').select('reaction_enabled').eq('user_id', owner).maybeSingle();
  if (result.error) throw result.error;
  await assertOwner(owner);
  return result.data?.reaction_enabled ?? false;
}
export async function setReactionNotifications(owner: string, enabled: boolean) {
  const release = beginAccountOperation({ name: 'notification-preference-write', source: 'reactionNotifications.setReactionNotifications' });
  try {
    await assertOwner(owner);
    const result = await supabase.from('notification_preferences').upsert({ user_id: owner, reaction_enabled: enabled });
    if (result.error) throw result.error;
    await assertOwner(owner);
  } finally { release(); }
}
