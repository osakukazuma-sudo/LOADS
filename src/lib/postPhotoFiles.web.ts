// Data URLs survive a reload; picker blob URLs do not. Stored with this user's snapshot.
export async function persistPhoto(uri: string, _userId: string, _postId: string): Promise<string> {
  if (!uri.startsWith('data:image/jpeg;base64,')) throw new Error('Could not prepare the photo. Please select it again.');
  return uri;
}

export async function photoBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

// Web photos are data URLs in the owner's outbox, removed with its storage keys.
export async function deleteAccountPhotos(_userId: string): Promise<void> {}
