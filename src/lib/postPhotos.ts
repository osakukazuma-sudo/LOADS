import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { persistPhoto, photoBytes } from './postPhotoFiles';
import { supabase } from './supabase';

export const PHOTO_BUCKET = 'post-photos';
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

export async function preparePhoto(uri: string, userId: string, postId: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  try {
    // Bound both dimensions, preserving the selected crop's aspect ratio.
    const original = await context.renderAsync();
    const scale = Math.min(1, 1600 / Math.max(original.width, original.height));
    const width = Math.max(1, Math.round(original.width * scale));
    original.release();
    context.resize({ width });
    const image = await context.renderAsync();
    try {
      const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: Platform.OS === 'web' });
      const source = Platform.OS === 'web' ? `data:image/jpeg;base64,${result.base64}` : result.uri;
      const bytes = await photoBytes(source);
      if (bytes.byteLength > MAX_PHOTO_BYTES) throw new Error('The photo is too large. Select a smaller image.');
      return persistPhoto(source, userId, postId);
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

export async function uploadPhoto(uri: string, userId: string, postId: string): Promise<string> {
  const path = `${userId}/${postId}.jpg`;
  const bytes = await photoBytes(uri);
  if (!bytes.byteLength || bytes.byteLength > MAX_PHOTO_BYTES) throw new Error('The saved photo is empty or too large.');
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  // Immutable path + immutable snapshot: a lost upload response can safely be retried.
  if (error) {
    const duplicate = ('code' in error && error.code === 'ResourceAlreadyExists') || String(error.statusCode) === '409';
    if (!duplicate) throw error;
    // Verify that the immutable object is readable before publishing its path.
    const existing = await supabase.storage.from(PHOTO_BUCKET).exists(path);
    if (existing.error || !existing.data) throw existing.error ?? error;
  }
  return path;
}
