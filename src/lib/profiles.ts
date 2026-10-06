import { supabase } from './supabase';
export function profileName(profile: { display_name: string | null; username: string }) {
  return profile.display_name?.trim() || profile.username;
}
export async function getProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('id,username,display_name').eq('id', userId).single();
  if (error) throw error;
  return data;
}
