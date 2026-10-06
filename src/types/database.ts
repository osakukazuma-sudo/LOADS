export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PostRow = {
  id: string;
  user_id: string;
  client_post_id: string;
  workout_id: string;
  created_at: string;
  caption: string;
  photo_path: string | null;
  duration_seconds: number;
  total_sets: number;
  total_volume: number;
  pr_count: number;
  exercises: Json;
  training_partner_ids?: string[];
};

type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

// Matches the inspected profiles table and the cloud-post migrations.
export type Database = {
  public: {
    Tables: {
      notification_preferences: { Row: { user_id: string; workout_enabled: boolean; partner_enabled: boolean }; Insert: { user_id: string; workout_enabled?: boolean; partner_enabled?: boolean }; Update: { workout_enabled?: boolean; partner_enabled?: boolean }; Relationships: [] };
      push_devices: { Row: { id: string; user_id: string; device_id: string; token: string; platform: string; enabled: boolean; updated_at: string }; Insert: never; Update: never; Relationships: [] };
      post_partners: { Row: { post_id: string; author_id: string; user_id: string; username: string }; Insert: never; Update: never; Relationships: [{ foreignKeyName: 'post_partners_post_id_fkey'; columns: ['post_id']; isOneToOne: false; referencedRelation: 'following_feed'; referencedColumns: ['id'] }] };
      workout_completions: { Row: { id: string; user_id: string; client_workout_id: string; finished_at: string; duration_seconds: number; created_at: string }; Insert: never; Update: never; Relationships: [] };

      follows: {
        Row: { follower_id: string; following_id: string; created_at: string };
        Insert: { follower_id: string; following_id: string };
        Update: never;
        Relationships: [
          { foreignKeyName: 'follows_follower_id_fkey'; columns: ['follower_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'follows_following_id_fkey'; columns: ['following_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      deleted_posts: {
        Row: { user_id: string; client_post_id: string; post_id: string; deleted_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Pick<ProfileRow, 'id' | 'username'> & Partial<Omit<ProfileRow, 'id' | 'username'>>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      posts: {
        Row: PostRow;
        Insert: Omit<PostRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<PostRow>;
        Relationships: [{
          foreignKeyName: 'posts_user_id_fkey';
          columns: ['user_id'];
          isOneToOne: false;
          referencedRelation: 'profiles';
          referencedColumns: ['id'];
        }];
      };
    };
    Views: { following_feed: {
      Row: PostRow;
      Relationships: [{ foreignKeyName: 'posts_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }];
    } };
    Functions: {
      register_push_device: { Args: { p_device_id: string; p_token: string; p_platform: string }; Returns: undefined };
      record_workout_completion: { Args: { p_workout_id: string; p_finished_at: string; p_duration_seconds: number }; Returns: string };
      my_follow_counts: { Args: Record<PropertyKey, never>; Returns: Json } };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
