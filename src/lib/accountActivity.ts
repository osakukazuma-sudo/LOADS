let operations = 0;
let signingOut = false;
export function beginAccountOperation() {
  if (signingOut) throw new Error('Sign out is in progress.');
  operations++;
  let ended = false;
  return () => { if (!ended) { ended = true; operations--; } };
}
export function beginSignOut() {
  if (operations || signingOut) throw new Error('Wait for the current upload or deletion to finish before signing out.');
  signingOut = true;
  return () => { signingOut = false; };
}
