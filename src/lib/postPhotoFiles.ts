import { Directory, File, Paths } from 'expo-file-system';

const PHOTO_REFERENCE = 'loads-photo:v1/';
const MISSING_PHOTO = 'The saved photo is unavailable. Other pending posts can still be sent.';

function photoPath(userId: string, postId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[a-zA-Z0-9_-]+$/.test(postId)) {
    throw new Error('Invalid saved photo reference.');
  }
  return `post-photos/${userId}/${postId}.jpg`;
}

export async function persistPhoto(uri: string, userId: string, postId: string): Promise<string> {
  const relativePath = photoPath(userId, postId);
  const directory = new Directory(Paths.document, 'post-photos', userId);
  directory.create({ intermediates: true, idempotent: true });
  const destination = new File(directory, `${postId}.jpg`);
  if (!destination.exists) new File(uri).copy(destination);
  return PHOTO_REFERENCE + relativePath;
}

export async function photoBytes(uri: string, userId?: string, postId?: string): Promise<ArrayBuffer> {
  // Unbound reads are only used for the freshly manipulated picker image.
  if (userId === undefined && postId === undefined) {
    if (uri.startsWith(PHOTO_REFERENCE)) throw new Error('Invalid saved photo reference.');
    return new File(uri).arrayBuffer();
  }
  const relativePath = photoPath(userId ?? '', postId ?? '');
  const stable = uri === PHOTO_REFERENCE + relativePath;
  const legacy = uri.startsWith('file:///') && uri.endsWith('/' + relativePath);
  if (!stable && !legacy) throw new Error('Invalid saved photo reference.');
  // Resolve inside today's Documents directory, never the previous container.
  // Keep the stored snapshot unchanged; no files are moved or removed.
  const file = new File(Paths.document, relativePath);
  try {
    if (!file.exists) throw new Error(MISSING_PHOTO);
    return await file.arrayBuffer();
  } catch {
    throw new Error(MISSING_PHOTO);
  }
}

export async function deleteAccountPhotos(userId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid account.');
  const directory = new Directory(Paths.document, 'post-photos', userId);
  if (directory.exists) directory.delete();
}
