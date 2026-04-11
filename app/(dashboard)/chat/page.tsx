import { MessageSquare } from 'lucide-react'

export default function ChatIndexPage() {
  return (
    <div className="hidden md:flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <MessageSquare size={28} className="text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-1">Select a channel</h3>
      <p className="text-slate-500 text-sm">Pick a channel or DM from the sidebar to start messaging</p>
    </div>
  )
}
