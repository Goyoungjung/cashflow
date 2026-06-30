import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(window.ENV.SUPABASE_URL, window.ENV.SUPABASE_ANON_KEY);

function persistToken(token) {
  sessionStorage.setItem('cf_token', token);
}

function clearToken() {
  sessionStorage.removeItem('cf_token');
  localStorage.removeItem('cf_token');
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  persistToken(data.session.access_token);
  return data.user;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (data.session) persistToken(data.session.access_token);
  return data.user;
}

export async function signOut() {
  await supabase.auth.signOut();
  clearToken();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    persistToken(data.session.access_token);
    return data.session;
  }
  return null;
}

supabase.auth.onAuthStateChange((event, session) => {
  if (session) persistToken(session.access_token);
  else clearToken();
});

export { supabase };
