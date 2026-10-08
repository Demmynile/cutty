import { Sidebar } from '@/components/ui/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 lg:ml-60 pt-20 px-4 pb-6 lg:pt-8 lg:px-8 lg:pb-8">{children}</main>
    </div>
  )
}
