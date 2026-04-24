import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import {
  LayoutGrid, BarChart3, Users, Receipt,
  ClipboardList, LogOut, Menu, X, ShieldCheck,
  Package, Clock, Tag, Wifi, Settings2
} from 'lucide-react'
import AlertsBell from '@/components/alerts/AlertsBell'
import clsx from 'clsx'

const navItems = [
  { to: '/',           label: 'الأجهزة',     icon: LayoutGrid,   end: true },
  { to: '/sessions',   label: 'الجلسات',     icon: ClipboardList           },
  { to: '/inventory',  label: 'البضاعة',     icon: Package                 },
  { to: '/shifts',     label: 'الشيفتات',    icon: Clock                   },
  { to: '/packages',   label: 'الباقات',     icon: Tag                     },
  { to: '/cards',      label: 'كروت النت',   icon: Wifi                    },
  { to: '/customers',  label: 'العملاء',     icon: Users                   },
  { to: '/analytics',  label: 'التحليلات',   icon: BarChart3,  adminOnly: true },
  { to: '/expenses',   label: 'المصاريف',    icon: Receipt,   adminOnly: true },
  { to: '/settings',  label: 'الإعدادات',   icon: Settings2, adminOnly: true },
]

export default function DashboardLayout() {
  const { profile, isAdmin, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const visibleNav = navItems.filter(item => !item.adminOnly || isAdmin)

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--ps-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,rgba(0,87,255,0.2),rgba(61,139,255,0.1))', border: '1px solid rgba(0,87,255,0.3)', boxShadow: '0 0 16px rgba(0,87,255,0.15)' }}
          >
            <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
              <path d="M8 28L8 12L18 12Q26 12 26 18Q26 22 22 23L26 28" stroke="#3d8bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M14 28Q14 32 20 32Q32 32 32 24Q32 20 26 20" stroke="#9b6dff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8"/>
            </svg>
          </div>
          <div>
            <p className="font-display text-xl tracking-[0.1em] text-ps-text leading-none">PS LOUNGE</p>
            <p className="text-xs text-ps-muted mt-0.5 font-mono">MANAGER v3</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              isActive ? 'text-ps-blue-light' : 'text-ps-muted hover:text-ps-text'
            )}
            style={({ isActive }) => isActive ? {
              background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,87,255,0.18)',
              boxShadow: '0 0 12px rgba(0,87,255,0.1)',
            } : { background: 'transparent', border: '1px solid transparent' }}
          >
            <item.icon size={17} />
            <span className="flex-1">{item.label}</span>
            {item.adminOnly && <ShieldCheck size={12} style={{ color: 'var(--ps-gold)', opacity: 0.7 }} />}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t space-y-1" style={{ borderColor: 'var(--ps-border)' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,rgba(0,87,255,0.2),rgba(155,109,255,0.2))', border: '1px solid rgba(0,87,255,0.3)', color: 'var(--ps-blue-light)' }}
          >{(profile?.name || 'U')[0].toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ps-text truncate leading-none mb-0.5">{profile?.name || 'مستخدم'}</p>
            <p className="text-xs text-ps-muted font-mono">{isAdmin ? '◆ ADMIN' : '◈ STAFF'}</p>
          </div>
        </div>
        <button onClick={handleSignOut}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-ps-muted hover:text-ps-red transition-all hover:bg-red-500/5"
        >
          <LogOut size={15} />تسجيل الخروج
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--ps-darker)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0"
        style={{ background: 'var(--ps-card)', borderLeft: '1px solid var(--ps-border)' }}
      >
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 flex flex-col animate-slide-up mr-auto"
            style={{ background: 'var(--ps-card)', borderLeft: '1px solid var(--ps-border)', boxShadow: '24px 0 64px rgba(0,0,0,0.6)' }}
          >
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 left-4 btn-ghost p-1.5 z-10"><X size={18} /></button>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b"
          style={{ background: 'var(--ps-card)', borderColor: 'var(--ps-border)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(0,87,255,0.15)', border: '1px solid rgba(0,87,255,0.3)' }}
            >
              <svg width="14" height="14" viewBox="0 0 40 40" fill="none">
                <path d="M8 28L8 12L18 12Q26 12 26 18Q26 22 22 23L26 28" stroke="#3d8bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M14 28Q14 32 20 32Q32 32 32 24Q32 20 26 20" stroke="#9b6dff" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <span className="font-display text-xl tracking-widest">PS LOUNGE</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertsBell />
            <button onClick={() => setSidebarOpen(true)} className="btn-ghost p-2"><Menu size={20} /></button>
          </div>
        </header>

        {/* Desktop top bar with alerts */}
        <div className="hidden lg:flex items-center justify-end px-6 py-2.5 border-b"
          style={{ borderColor: 'var(--ps-border)', background: 'var(--ps-card)' }}
        >
          <AlertsBell />
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
