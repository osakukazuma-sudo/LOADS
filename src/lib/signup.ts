import { supabase } from './supabase';

const usernameTakenMessage = 'This username is already taken.';
const databaseFailureMessage = 'Could not create account. Please try again later.';
type SignupError = { message: string; code?: string; details?: string };

// Unknown means the lookup failed; never treat a failed query as availability.
async function usernameTaken(username: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.from('profiles')
      .select('username').eq('username', username).limit(1).maybeSingle();
    return error ? null : data !== null;
  } catch {
    return null;
  }
}

async function signupErrorMessage(error: SignupError, username: string) {
  const detail = `${error.message} ${error.details ?? ''}`;
  if (/profiles_username_key/i.test(detail) &&
      (error.code === '23505' || /unique|duplicate|already exists/i.test(detail))) {
    return usernameTakenMessage;
  }
  // Auth masks trigger errors. Recheck after failure to catch a concurrent signup,
  // without labelling unrelated Auth errors (e.g. duplicate email) as username errors.
  if (error.code === 'unexpected_failure' || error.code === '23505' ||
      /database error saving new user/i.test(error.message)) {
    return await usernameTaken(username) === true ? usernameTakenMessage : databaseFailureMessage;
  }
  return error.message;
}

export async function createAccount(input: {
  username: string; displayName: string; email: string; password: string; emailRedirectTo: string;
}) {
  const username = input.username.trim().toLowerCase();
  if (await usernameTaken(username) === true) {
    return { data: null, error: { message: usernameTakenMessage } };
  }
  // The database constraint remains authoritative if lookup fails or a race occurs.
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      emailRedirectTo: input.emailRedirectTo,
      data: { username, display_name: input.displayName.trim() || username },
    },
  });
  return { data, error: error ? { message: await signupErrorMessage(error, username) } : null };
}
