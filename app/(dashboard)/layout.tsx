import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Topbar } from '@/components/layout/Topbar'
import { RealtimeProvider } from '@/components/layout/RealtimeProvider'
import { DialogProvider } from '@/components/shared/DialogProvider'
import { NavigationProgress } from '@/components/shared/NavigationProgress'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <NavigationProgress />
      <DialogProvider>
        <div className="flex min-h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
              {children}
            </main>
          </div>
        </div>
        <MobileNav />
      </DialogProvider>
    </RealtimeProvider>
  )
}
