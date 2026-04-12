import { MessageSquare } from 'lucide-react'

// On mobile the chat layout shows the sidebar at /chat.
// On desktop show a placeholder prompting channel selection.
export default function ChatIndexPage() {
  return (
    <div className="hidden h-full flex-col items-center justify-center px-4 text-center md:flex">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-800/80">
        <MessageSquare size={28} className="text-cyan-600 dark:text-cyan-300" />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">Select a conversation</h3>
      <p className="max-w-xs text-sm text-slate-500">
        Pick a channel or start a DM from the sidebar on the left
      </p>
    </div>
  )
}
