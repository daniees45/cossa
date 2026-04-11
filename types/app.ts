import type { Database } from './database'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Post = Database['public']['Tables']['posts']['Row']
export type PostComment = Database['public']['Tables']['post_comments']['Row']
export type Election = Database['public']['Tables']['elections']['Row']
export type Candidate = Database['public']['Tables']['candidates']['Row']
export type Vote = Database['public']['Tables']['votes']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type Announcement = Database['public']['Tables']['announcements']['Row']
export type Resource = Database['public']['Tables']['resources']['Row']
export type Channel = Database['public']['Tables']['channels']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type Competition = Database['public']['Tables']['competitions']['Row']
export type Submission = Database['public']['Tables']['competition_submissions']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

export type PostWithAuthor = Post & {
  author: Profile
  liked_by_me?: boolean
  bookmarked_by_me?: boolean
}

export type CommentWithAuthor = PostComment & {
  author: Profile
  replies?: CommentWithAuthor[]
}

export type CandidateWithProfile = Candidate & {
  profile: Profile
}

export type MessageWithSender = Message & {
  sender: Profile
}

export type NavItem = {
  label: string
  href: string
  icon: string
}
