export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string
          avatar_url: string | null
          banner_url: string | null
          avatar_frame: string
          bio: string | null
          level: string | null
          department: string | null
          role: 'student' | 'admin' | 'super_admin'
          index_number: string | null
          public_key: string | null
          encrypted_private_key: string | null
          is_banned: boolean
          ban_reason: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          full_name: string
          avatar_url?: string | null
          banner_url?: string | null
          avatar_frame?: string
          bio?: string | null
          level?: string | null
          department?: string | null
          role?: 'student' | 'admin' | 'super_admin'
          index_number?: string | null
          public_key?: string | null
          encrypted_private_key?: string | null
          is_banned?: boolean
          ban_reason?: string | null
          created_at?: string
        }
        Update: {
          username?: string
          full_name?: string
          avatar_url?: string | null
          banner_url?: string | null
          avatar_frame?: string
          bio?: string | null
          level?: string | null
          department?: string | null
          role?: 'student' | 'admin' | 'super_admin'
          index_number?: string | null
          public_key?: string | null
          encrypted_private_key?: string | null
          is_banned?: boolean
          ban_reason?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          id: string
          author_id: string
          content: string
          media_urls: string[] | null
          type: 'post' | 'meme' | 'achievement' | 'event_post'
          likes_count: number
          comments_count: number
          pinned: boolean
          created_at: string
        }
        Insert: {
          id?: string
          author_id: string
          content: string
          media_urls?: string[] | null
          type?: 'post' | 'meme' | 'achievement' | 'event_post'
          likes_count?: number
          comments_count?: number
          pinned?: boolean
          created_at?: string
        }
        Update: {
          content?: string
          media_urls?: string[] | null
          type?: 'post' | 'meme' | 'achievement' | 'event_post'
          pinned?: boolean
        }
        Relationships: []
      }
      post_likes: {
        Row: { post_id: string; user_id: string }
        Insert: { post_id: string; user_id: string }
        Update: never
        Relationships: []
      }
      post_bookmarks: {
        Row: { post_id: string; user_id: string; created_at: string }
        Insert: { post_id: string; user_id: string; created_at?: string }
        Update: never
        Relationships: []
      }
      post_comments: {
        Row: {
          id: string
          post_id: string
          author_id: string
          content: string
          parent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          author_id: string
          content: string
          parent_id?: string | null
          created_at?: string
        }
        Update: { content?: string }
        Relationships: []
      }
      post_reports: {
        Row: {
          id: string
          post_id: string
          reporter_id: string
          reason: 'spam' | 'inappropriate' | 'harassment' | 'misinformation' | 'other'
          note: string | null
          status: 'pending' | 'reviewed' | 'dismissed'
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          reporter_id: string
          reason: 'spam' | 'inappropriate' | 'harassment' | 'misinformation' | 'other'
          note?: string | null
          status?: 'pending' | 'reviewed' | 'dismissed'
          created_at?: string
        }
        Update: {
          reason?: 'spam' | 'inappropriate' | 'harassment' | 'misinformation' | 'other'
          note?: string | null
          status?: 'pending' | 'reviewed' | 'dismissed'
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          id: string
          admin_id: string
          action: string
          target_type: string
          target_id: string | null
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          admin_id: string
          action: string
          target_type: string
          target_id?: string | null
          details?: Json
          created_at?: string
        }
        Update: {
          action?: string
          target_type?: string
          target_id?: string | null
          details?: Json
        }
        Relationships: []
      }
      elections: {
        Row: {
          id: string
          title: string
          description: string | null
          banner_url: string | null
          status: 'draft' | 'active' | 'closed'
          starts_at: string
          ends_at: string
          eligible_levels: string[] | null
          require_index_number: boolean
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          banner_url?: string | null
          status?: 'draft' | 'active' | 'closed'
          starts_at: string
          ends_at: string
          eligible_levels?: string[] | null
          require_index_number?: boolean
          created_by: string
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          banner_url?: string | null
          status?: 'draft' | 'active' | 'closed'
          starts_at?: string
          ends_at?: string
          eligible_levels?: string[] | null
          require_index_number?: boolean
        }
        Relationships: []
      }
      candidates: {
        Row: {
          id: string
          election_id: string
          user_id: string
          position: string
          manifesto: string | null
          photo_url: string | null
          votes_count: number
        }
        Insert: {
          id?: string
          election_id: string
          user_id: string
          position: string
          manifesto?: string | null
          photo_url?: string | null
          department?: string | null
          level?: string | null
          votes_count?: number
        }
        Update: {
          position?: string
          manifesto?: string | null
          photo_url?: string | null
          votes_count?: number
        }
        Relationships: []
      }
      votes: {
        Row: {
          id: string
          election_id: string
          candidate_id: string
          voter_id: string
          created_at: string
        }
        Insert: {
          id?: string
          election_id: string
          candidate_id: string
          voter_id: string
          created_at?: string
        }
        Update: never
        Relationships: []
      }
      voter_rolls: {
        Row: {
          id: string
          election_id: string
          student_id: string
          full_name: string
          voter_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          election_id: string
          student_id: string
          full_name: string
          voter_id?: string | null
          created_at?: string
        }
        Update: {
          voter_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          title: string
          description: string | null
          cover_url: string | null
          type: 'social_event' | 'competition' | 'seminar' | 'fun'
          location: string | null
          event_date: string
          rsvp_count: number
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          cover_url?: string | null
          type?: 'social_event' | 'competition' | 'seminar' | 'fun'
          location?: string | null
          event_date: string
          rsvp_count?: number
          created_by: string
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          cover_url?: string | null
          type?: 'social_event' | 'competition' | 'seminar' | 'fun'
          location?: string | null
          event_date?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: { event_id: string; user_id: string }
        Insert: { event_id: string; user_id: string }
        Update: never
        Relationships: []
      }
      announcements: {
        Row: {
          id: string
          title: string
          body: string
          category: 'news' | 'academic' | 'urgent'
          pinned: boolean
          author_id: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          body: string
          category?: 'news' | 'academic' | 'urgent'
          pinned?: boolean
          author_id: string
          created_at?: string
        }
        Update: {
          title?: string
          body?: string
          category?: 'news' | 'academic' | 'urgent'
          pinned?: boolean
        }
        Relationships: []
      }
      resources: {
        Row: {
          id: string
          title: string
          description: string | null
          file_url: string
          course_code: string | null
          level: string | null
          uploaded_by: string
          downloads: number
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          file_url: string
          course_code?: string | null
          level?: string | null
          uploaded_by: string
          downloads?: number
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          file_url?: string
          course_code?: string | null
          level?: string | null
          downloads?: number
        }
        Relationships: []
      }
      channels: {
        Row: {
          id: string
          name: string
          description: string | null
          avatar_url: string | null
          emoji_icon: string | null
          color_hex: string | null
          type: 'public' | 'private' | 'announcement'
          private_join_mode: 'approval' | 'code'
          private_entry_code: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          avatar_url?: string | null
          emoji_icon?: string | null
          color_hex?: string | null
          type?: 'public' | 'private' | 'announcement'
          private_join_mode?: 'approval' | 'code'
          private_entry_code?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          avatar_url?: string | null
          emoji_icon?: string | null
          color_hex?: string | null
          type?: 'public' | 'private' | 'announcement'
          private_join_mode?: 'approval' | 'code'
          private_entry_code?: string | null
        }
        Relationships: []
      }
      channel_members: {
        Row: { channel_id: string; user_id: string; role: string }
        Insert: { channel_id: string; user_id: string; role?: string }
        Update: { role?: string }
        Relationships: []
      }
      channel_join_requests: {
        Row: {
          id: string
          channel_id: string
          user_id: string
          status: 'pending' | 'approved' | 'rejected'
          request_note: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          user_id: string
          status?: 'pending' | 'approved' | 'rejected'
          request_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          status?: 'pending' | 'approved' | 'rejected'
          request_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Relationships: []
      }
      channel_creation_requests: {
        Row: {
          id: string
          requested_by: string
          name: string
          description: string | null
          type: 'public' | 'private'
          private_join_mode: 'approval' | 'code'
          private_entry_code: string | null
          status: 'pending' | 'approved' | 'rejected'
          review_note: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          requested_by: string
          name: string
          description?: string | null
          type?: 'public' | 'private'
          private_join_mode?: 'approval' | 'code'
          private_entry_code?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          type?: 'public' | 'private'
          private_join_mode?: 'approval' | 'code'
          private_entry_code?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          channel_id: string | null
          sender_id: string
          receiver_id: string | null
          content: string
          media_url: string | null
          read_at: string | null
          edited_at: string | null
          deleted_for_sender: boolean
          created_at: string
        }
        Insert: {
          id?: string
          channel_id?: string | null
          sender_id: string
          receiver_id?: string | null
          content: string
          media_url?: string | null
          read_at?: string | null
          edited_at?: string | null
          created_at?: string
        }
        Update: {
          content?: string
          media_url?: string | null
          read_at?: string | null
          edited_at?: string | null
          deleted_for_sender?: boolean
        }
        Relationships: []
      }
      competitions: {
        Row: {
          id: string
          title: string
          description: string | null
          type: 'hackathon' | 'quiz' | 'coding_challenge'
          rules: string | null
          prizes: string | null
          status: 'upcoming' | 'active' | 'ended'
          starts_at: string
          ends_at: string
          max_team_size: number
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          type?: 'hackathon' | 'quiz' | 'coding_challenge'
          rules?: string | null
          prizes?: string | null
          status?: 'upcoming' | 'active' | 'ended'
          starts_at: string
          ends_at: string
          max_team_size?: number
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          type?: 'hackathon' | 'quiz' | 'coding_challenge'
          rules?: string | null
          prizes?: string | null
          status?: 'upcoming' | 'active' | 'ended'
          starts_at?: string
          ends_at?: string
          max_team_size?: number
        }
        Relationships: []
      }
      competition_submissions: {
        Row: {
          id: string
          competition_id: string
          submitter_id: string
          team_name: string | null
          repo_url: string | null
          demo_url: string | null
          description: string | null
          score: number | null
          rank: number | null
          submitted_at: string
        }
        Insert: {
          id?: string
          competition_id: string
          submitter_id: string
          team_name?: string | null
          repo_url?: string | null
          demo_url?: string | null
          description?: string | null
          score?: number | null
          rank?: number | null
          submitted_at?: string
        }
        Update: {
          team_name?: string | null
          repo_url?: string | null
          demo_url?: string | null
          description?: string | null
          score?: number | null
          rank?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string
          link: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body: string
          link?: string | null
          read?: boolean
          created_at?: string
        }
        Update: { read?: boolean }
        Relationships: []
      }
      followers: {
        Row: { follower_id: string; following_id: string }
        Insert: { follower_id: string; following_id: string }
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      broadcast_notification: {
        Args: {
          p_title: string
          p_body: string
          p_link?: string | null
          p_levels?: string[] | null
        }
        Returns: number
      }
      get_login_email: {
        Args: { p_identifier: string }
        Returns: string | null
      }
      get_voter_roll_count: {
        Args: { p_election_id: string }
        Returns: number
      }
      verify_voter: {
        Args: {
          p_election_id: string
          p_student_id:  string
          p_user_id:     string
        }
        Returns: { ok: boolean; error?: string; name?: string }
      }
      cast_ballot: {
        Args: {
          p_election_id: string
          p_candidate_ids: string[]
        }
        Returns: { ok: boolean; error?: string; count?: number }
      }
      request_channel_join: {
        Args: {
          p_channel_id: string
          p_entry_code?: string | null
        }
        Returns: { ok: boolean; joined?: boolean; pending?: boolean; already_member?: boolean; error?: string }
      }
      review_channel_join_request: {
        Args: {
          p_channel_id: string
          p_user_id: string
          p_approve: boolean
        }
        Returns: { ok: boolean; approved?: boolean; error?: string }
      }
      request_channel_creation: {
        Args: {
          p_name: string
          p_description?: string | null
          p_type?: string
          p_private_join_mode?: string
          p_private_entry_code?: string | null
        }
        Returns: { ok: boolean; pending?: boolean; error?: string }
      }
      review_channel_creation_request: {
        Args: {
          p_request_id: string
          p_approve: boolean
          p_review_note?: string | null
        }
        Returns: { ok: boolean; approved?: boolean; channel_id?: string; error?: string }
      }
      update_channel_details: {
        Args: {
          p_channel_id: string
          p_name?: string | null
          p_description?: string | null
          p_avatar_url?: string | null
          p_emoji_icon?: string | null
          p_color_hex?: string | null
        }
        Returns: { ok: boolean; error?: string }
      }
      set_channel_member_role: {
        Args: {
          p_channel_id: string
          p_user_id: string
          p_role: string
        }
        Returns: { ok: boolean; error?: string }
      }
      remove_channel_member: {
        Args: {
          p_channel_id: string
          p_user_id: string
        }
        Returns: { ok: boolean; error?: string; self_left?: boolean }
      }
      is_message_seen: {
        Args: {
          p_message_id: string
          p_viewer_id: string
        }
        Returns: boolean
      }
      check_can_edit_message: {
        Args: {
          p_message_id: string
          p_user_id: string
        }
        Returns: { ok: boolean; error?: string }
      }
      update_message: {
        Args: {
          p_message_id: string
          p_new_content: string
        }
        Returns: { ok: boolean; error?: string }
      }
      mark_message_viewed: {
        Args: {
          p_message_id: string
        }
        Returns: { ok: boolean; error?: string }
      }
      mark_channel_messages_viewed: {
        Args: {
          p_channel_id: string
        }
        Returns: { ok: boolean; error?: string }
      }
      set_encrypted_private_key: {
        Args: {
          p_blob: string
        }
        Returns: { ok: boolean; error?: string }
      }
      get_encrypted_private_key: {
        Args: Record<string, never>
        Returns: string | null
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_target_type: string
          p_target_id?: string | null
          p_details?: Json
        }
        Returns: string
      }
    }
    Enums: Record<string, never>
  }
}
