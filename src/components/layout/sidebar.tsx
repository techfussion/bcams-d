/**
 * BCAMS Application Sidebar
 * 
 * Role-aware navigation. Only shows items the current user's role can access.
 */
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, CalendarCheck, Fingerprint, Users, GraduationCap,
  Building2, BookOpen, Monitor, ShieldCheck, BarChart3, ClipboardList,
  DoorOpen, Settings, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { UserRole } from '@/types';

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const sidebarItems: SidebarItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: <LayoutDashboard className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod', 'lecturer', 'class_rep'],
  },
  {
    label: 'Sessions',
    path: '/sessions',
    icon: <CalendarCheck className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod', 'lecturer', 'class_rep'],
  },
  {
    label: 'Attendance',
    path: '/attendance',
    icon: <Fingerprint className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod', 'lecturer', 'class_rep'],
  },
  {
    label: 'Gate Attendance',
    path: '/gate',
    icon: <DoorOpen className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod'],
  },
  {
    label: 'Students',
    path: '/people/students',
    icon: <GraduationCap className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod'],
  },
  {
    label: 'Lecturers',
    path: '/people/lecturers',
    icon: <Users className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod'],
  },
  {
    label: 'Staff',
    path: '/people/staff',
    icon: <Users className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod'],
  },
  {
    label: 'Enrollment',
    path: '/enrollment',
    icon: <Fingerprint className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod'],
  },
  {
    label: 'Departments',
    path: '/academic/departments',
    icon: <Building2 className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod'],
  },
  {
    label: 'Courses',
    path: '/academic/courses',
    icon: <BookOpen className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod'],
  },
  {
    label: 'Devices',
    path: '/devices',
    icon: <Monitor className="h-[18px] w-[18px]" />,
    roles: ['super_admin'],
  },
  {
    label: 'Policies',
    path: '/policies',
    icon: <ShieldCheck className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod'],
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: <BarChart3 className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod', 'lecturer'],
  },
  {
    label: 'Audit Log',
    path: '/audit',
    icon: <ClipboardList className="h-[18px] w-[18px]" />,
    roles: ['super_admin'],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: <Settings className="h-[18px] w-[18px]" />,
    roles: ['super_admin', 'hod', 'lecturer', 'class_rep'],
  },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);

  const visibleItems = sidebarItems.filter(
    item => user && item.roles.includes(user.role)
  );

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-white border-r border-border transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Fingerprint className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold tracking-tight text-foreground">BCAMS</span>
              <span className="text-[10px] text-muted-foreground leading-tight">Desktop</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <ul className="space-y-0.5">
          {visibleItems.map(item => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-nav transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={cn(isActive && 'text-primary')}>{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border px-2 py-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="ml-3 text-nav">Collapse</span>}
        </button>
      </div>

      {/* User section */}
      {user && (
        <div className={cn('border-t border-border px-3 py-3', collapsed && 'px-2')}>
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-medium text-primary-700">
                {user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.fullName}</p>
                <p className="text-[11px] text-muted-foreground capitalize">
                  {user.role.replace('_', ' ')}
                </p>
              </div>
              <button
                onClick={logout}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-medium text-primary-700">
                {user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
