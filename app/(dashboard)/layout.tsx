import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Topbar } from '@/components/layout/Topbar'
import { RealtimeProvider } from '@/components/layout/RealtimeProvider'
import { DialogProvider } from '@/components/shared/DialogProvider'
import { NavigationProgress } from '@/components/shared/NavigationProgress'
import { DashboardTransitionShell } from '@/components/layout/DashboardTransitionShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <NavigationProgress />
      <DialogProvider>
        <div
          className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950"
          style={{ ['--mobile-nav-height' as string]: 'calc(3.75rem + env(safe-area-inset-bottom))' }}
        >
          <Sidebar />
          <div className="flex-1 flex h-screen flex-col min-w-0 overflow-y-auto">
            <Topbar />
            <main className="flex-1 flex flex-col min-h-0 overflow-visible pb-[var(--mobile-nav-height)] md:pb-0">
              <DashboardTransitionShell>{children}</DashboardTransitionShell>
            </main>
          </div>
        </div>
        <MobileNav />
      </DialogProvider>
    </RealtimeProvider>
  )
}
