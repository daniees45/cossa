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
          bio: string | null
          level: string | null
          department: string | null
          role: 'student' | 'admin' | 'super_admin'
          index_number: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          full_name: string
          avatar_url?: string | null
          bio?: string | null
          level?: string | null
          department?: string | null
          role?: 'student' | 'admin' | 'super_admin'
          index_number?: string | null
          created_at?: string
        }
        Update: {
          username?: string
          full_name?: string
          avatar_url?: string | null
          bio?: string | null
          level?: string | null
          department?: string | null
          role?: 'student' | 'admin' | 'super_admin'
          index_number?: string | null
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
      elections: {
        Row: {
          id: string
          title: string
          description: string | null
          banner_url: string | null
          status: 'draft' | 'active' | 'closed'
          starts_at: string
          ends_at: string
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
          type: 'public' | 'private' | 'announcement'
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          type?: 'public' | 'private' | 'announcement'
          created_by: string
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          type?: 'public' | 'private' | 'announcement'
        }
        Relationships: []
      }
      channel_members: {
        Row: { channel_id: string; user_id: string; role: string }
        Insert: { channel_id: string; user_id: string; role?: string }
        Update: { role?: string }
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
          created_at?: string
        }
        Update: { read_at?: string | null }
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
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
