import { createClient } from '@/lib/supabase/client'

type Bucket = 'avatars' | 'posts' | 'gallery' | 'resources' | 'covers'

export async function uploadFile(
  file: File,
  bucket: Bucket,
  path: string
): Promise<string> {
  const supabase = createClient()
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
