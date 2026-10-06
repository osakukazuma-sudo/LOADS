import { Directory, File, Paths } from 'expo-file-system';

export async function persistPhoto(uri: string, userId: string, postId: string): Promise<string> {
  const directory = new Directory(Paths.document, 'post-photos', userId);
  directory.create({ intermediates: true, idempotent: true });
  const destination = new File(directory, `${postId}.jpg`);
  if (!destination.exists) new File(uri).copy(destination);
  return destination.uri;
}

export async function photoBytes(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}

export async function deleteAccountPhotos(userId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid account.');
  const directory = new Directory(Paths.document, 'post-photos', userId);
  if (directory.exists) directory.delete();
}
