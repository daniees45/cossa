'use client'
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
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
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-desc"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 pt-6 pb-5">
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

        <div className="flex gap-2 px-6 pb-5 justify-end">
          <button
            autoFocus
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium text-white transition',
              variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-violet-600 hover:bg-violet-500',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
