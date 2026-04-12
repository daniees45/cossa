'use client'
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DialogOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' renders the confirm button in red */
  variant?: 'danger' | 'default'
}

interface DialogContextValue {
  confirm: (opts: DialogOptions | string) => Promise<boolean>
}

// ── Context ──────────────────────────────────────────────────────────────────

const DialogContext = createContext<DialogContextValue>({
  confirm: async () => false,
})

export function useDialog() {
  return useContext(DialogContext)
}

// ── Internal modal state ─────────────────────────────────────────────────────

interface ModalState extends DialogOptions {
  open: boolean
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null)
  const resolveRef = useRef<((result: boolean) => void) | null>(null)

  const confirm = useCallback((opts: DialogOptions | string): Promise<boolean> => {
    const options: DialogOptions = typeof opts === 'string' ? { message: opts } : opts
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setModal({ ...options, open: true })
    })
  }, [])

  function handle(result: boolean) {
    setModal(null)
    resolveRef.current?.(result)
    resolveRef.current = null
  }

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {modal?.open && (
          <ConfirmModal
            title={modal.title}
            message={modal.message}
            confirmLabel={modal.confirmLabel}
            cancelLabel={modal.cancelLabel}
            variant={modal.variant}
            onConfirm={() => handle(true)}
            onCancel={() => handle(false)}
          />
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  )
}

// ── Modal UI ─────────────────────────────────────────────────────────────────

interface ConfirmModalProps extends DialogOptions {
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 pt-8 sm:items-center sm:px-4 sm:pb-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-desc"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <motion.div
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="px-5 pb-5 pt-6 sm:px-6">
          {title && (
            <h2
              id="dialog-title"
              className="text-base font-semibold text-slate-900 dark:text-white mb-1.5"
            >
              {title}
            </h2>
          )}
          <p
            id="dialog-desc"
            className={cn(
              'text-sm text-slate-600 dark:text-slate-300 leading-relaxed',
              !title && 'font-medium text-slate-800 dark:text-slate-200',
            )}
          >
            {message}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:pb-5">
          <button
            autoFocus
            onClick={onCancel}
            className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 sm:w-auto sm:py-2"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white transition sm:w-auto sm:py-2',
              variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-violet-600 hover:bg-violet-500',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
