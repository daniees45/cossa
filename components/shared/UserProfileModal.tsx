'use client'
import { useEffect, useState } from 'react'
import { UserProfileDisplay } from './UserProfileDisplay'
import { MessageSquare, ExternalLink, X } from 'lucide-react'
import Link from 'next/link'

interface UserProfileModalProps {
  userId: string
  username: string
  children?: React.ReactNode
  trigger?: 'click' | 'hover'
}

export function UserProfileModal({
  userId,
  username,
  children,
  trigger = 'click',
}: UserProfileModalProps) {
  const [open, setOpen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const shouldShow = trigger === 'click' ? open : isHovering

  useEffect(() => {
    if (shouldShow) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [shouldShow])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape' && trigger === 'click') setOpen(false)
    }
    if (shouldShow) {
      document.addEventListener('keydown', handler)
    }
    return () => document.removeEventListener('keydown', handler)
  }, [shouldShow, trigger])

  return (
    <>
      <div
        onClick={() => trigger === 'click' && setOpen(true)}
        onMouseEnter={() => trigger === 'hover' && setIsHovering(true)}
        onMouseLeave={() => trigger === 'hover' && setIsHovering(false)}
        className={trigger === 'hover' ? 'cursor-pointer' : ''}
      >
        {children}
      </div>

      {shouldShow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => trigger === 'click' && setOpen(false)}
          />

          {/* Modal */}
          <div className="relative z-10 flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-xl dark:bg-slate-900 sm:mx-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg">
            {/* Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">User Profile</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <UserProfileDisplay userId={userId} />
            </div>

            {/* Footer with Actions */}
            <div className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:px-6 sm:pb-4">
              <Link href={`/profile/${username}`} className="flex-1">
                <button
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                >
                  <ExternalLink size={14} />
                  View Profile
                </button>
              </Link>
              <Link href={`/chat/dm/${userId}`} className="flex-1">
                <button
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors text-sm font-medium"
                >
                  <MessageSquare size={14} />
                  Message
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
