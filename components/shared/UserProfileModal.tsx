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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => trigger === 'click' && setOpen(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white dark:bg-slate-900 shadow-xl mx-4">
            {/* Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">User Profile</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <UserProfileDisplay userId={userId} />
            </div>

            {/* Footer with Actions */}
            <div className="sticky bottom-0 z-20 flex gap-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4">
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
