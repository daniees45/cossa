import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Topbar } from '@/components/layout/Topbar'
import { RealtimeProvider } from '@/components/layout/RealtimeProvider'
import { DialogProvider } from '@/components/shared/DialogProvider'
import { NavigationProgress } from '@/components/shared/NavigationProgress'
import { DashboardTransitionShell } from '@/components/layout/DashboardTransitionShell'
import { InitialDashboardSplash } from '@/components/layout/InitialDashboardSplash'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <InitialDashboardSplash />
      <NavigationProgress />
      <DialogProvider>
        <div
          className="flex min-h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950"
          style={{ ['--mobile-nav-height' as string]: 'calc(3.75rem + env(safe-area-inset-bottom))' }}
        >
          <Sidebar />
          <div className="flex-1 flex min-h-dvh flex-col min-w-0 overflow-hidden">
            <Topbar />
            <main
              id="dashboard-main"
              tabIndex={-1}
              className="subtle-scrollbar flex-1 flex flex-col min-h-0 overflow-y-auto [scrollbar-gutter:stable] pb-[var(--mobile-nav-height)] md:pb-0"
            >
              <DashboardTransitionShell>{children}</DashboardTransitionShell>
            </main>
          </div>
        </div>
        <MobileNav />
      </DialogProvider>
    </RealtimeProvider>
  )
}
