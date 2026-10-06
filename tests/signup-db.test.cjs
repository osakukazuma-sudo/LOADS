const test = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');

test('documented profile trigger accepts unused usernames and rolls back duplicate Auth inserts', async () => {
  const db = new PGlite();
  try {
    // Mirrors the inspected existing trigger in docs/supabase-current-state.md.
    await db.exec(`create role anon;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
      create table public.profiles(id uuid primary key references auth.users(id),
        username text not null constraint profiles_username_key unique, display_name text);
      alter table public.profiles enable row level security;
      grant select on public.profiles to anon;
      create policy "Profiles are publicly readable" on public.profiles for select using (true);
      create function public.handle_new_user() returns trigger language plpgsql security definer
      set search_path = '' as $$begin
        insert into public.profiles(id,username,display_name)
        values(new.id,new.raw_user_meta_data->>'username',new.raw_user_meta_data->>'display_name');
        return new;
      end$$;
      create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();`);
    const insert = (id, username) => db.query(
      'insert into auth.users values($1,$2)', [id, { username, display_name: 'Alice' }]);
    await insert('11111111-1111-4111-8111-111111111111', 'new_user');
    await db.exec('set role anon');
    assert.equal((await db.query('select username from public.profiles where username=$1 limit 1', ['new_user'])).rows.length, 1);
    assert.equal((await db.query('select username from public.profiles where username=$1 limit 1', ['unused'])).rows.length, 0);
    await db.exec('reset role');
    await assert.rejects(insert('22222222-2222-4222-8222-222222222222', 'new_user'),
      error => error.code === '23505' && error.constraint === 'profiles_username_key');
    assert.equal((await db.query('select count(*)::int as count from auth.users')).rows[0].count, 1);
    await insert('33333333-3333-4333-8333-333333333333', 'unused');
    assert.equal((await db.query('select count(*)::int as count from public.profiles')).rows[0].count, 2);
  } finally { await db.close(); }
});
