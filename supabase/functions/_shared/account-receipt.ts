export async function receiptHash(receipt: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(receipt));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
