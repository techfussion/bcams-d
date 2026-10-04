/**
 * Command Palette
 * 
 * Quick-access command palette triggered by Ctrl+K / Cmd+K.
 * Provides fuzzy navigation to any page and quick actions.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, CalendarCheck, Fingerprint, Users, GraduationCap,
  Building2, BookOpen, Monitor, ShieldCheck, BarChart3, ClipboardList,
  DoorOpen, Settings, Search, RefreshCw, Wifi, WifiOff,
  ArrowRight,
} from 'lucide-react';
import type { UserRole } from '@/types';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'action';
  roles: UserRole[];
  keywords: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { toggleConnection, openSyncModal, syncNow } = useSyncStore();

  const items: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'nav-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, action: () => navigate('/'), category: 'navigation', roles: ['super_admin', 'hod', 'lecturer', 'student', 'staff'], keywords: ['home', 'overview', 'stats'] },
    { id: 'nav-sessions', label: 'Sessions', icon: <CalendarCheck className="h-4 w-4" />, action: () => navigate('/sessions'), category: 'navigation', roles: ['super_admin', 'hod', 'lecturer', 'student'], keywords: ['class', 'schedule', 'timetable'] },
    { id: 'nav-attendance', label: 'Attendance', icon: <Fingerprint className="h-4 w-4" />, action: () => navigate('/attendance'), category: 'navigation', roles: ['super_admin', 'hod', 'lecturer'], keywords: ['records', 'events', 'ledger'] },
    { id: 'nav-gate', label: 'Gate Attendance', icon: <DoorOpen className="h-4 w-4" />, action: () => navigate('/gate'), category: 'navigation', roles: ['super_admin', 'staff'], keywords: ['clock', 'entry', 'exit', 'gate'] },
    { id: 'nav-students', label: 'Students', icon: <GraduationCap className="h-4 w-4" />, action: () => navigate('/people/students'), category: 'navigation', roles: ['super_admin', 'hod'], keywords: ['people', 'registry', 'matric'] },
    { id: 'nav-enrollment-mgmt', label: 'Academic Enrollment', icon: <GraduationCap className="h-4 w-4" />, action: () => navigate('/academic/enrollment'), category: 'navigation', roles: ['super_admin', 'hod'], keywords: ['progression', 'level', 'courses', 'session'] },
    { id: 'nav-lecturers', label: 'Lecturers', icon: <Users className="h-4 w-4" />, action: () => navigate('/people/lecturers'), category: 'navigation', roles: ['super_admin', 'hod'], keywords: ['people', 'faculty', 'instructor'] },
    { id: 'nav-staff', label: 'Staff Management', icon: <Users className="h-4 w-4" />, action: () => navigate('/people/staff'), category: 'navigation', roles: ['super_admin'], keywords: ['people', 'employee', 'personnel', 'registry'] },
    { id: 'nav-enrollment', label: 'Biometric Enrollment', icon: <Fingerprint className="h-4 w-4" />, action: () => navigate('/enrollment'), category: 'navigation', roles: ['super_admin', 'hod'], keywords: ['biometric', 'finger', 'register'] },
    { id: 'nav-departments', label: 'Departments', icon: <Building2 className="h-4 w-4" />, action: () => navigate('/academic/departments'), category: 'navigation', roles: ['super_admin', 'hod'], keywords: ['faculty', 'academic', 'structure'] },
    { id: 'nav-courses', label: 'Courses', icon: <BookOpen className="h-4 w-4" />, action: () => navigate('/academic/courses'), category: 'navigation', roles: ['super_admin', 'hod'], keywords: ['module', 'subject', 'academic'] },
    { id: 'nav-devices', label: 'Trusted Devices', icon: <Monitor className="h-4 w-4" />, action: () => navigate('/devices'), category: 'navigation', roles: ['super_admin'], keywords: ['scanner', 'hardware', 'endpoint', 'terminal'] },
    { id: 'nav-policies', label: 'Institutional Policies', icon: <ShieldCheck className="h-4 w-4" />, action: () => navigate('/policies'), category: 'navigation', roles: ['super_admin'], keywords: ['rules', 'threshold', 'geofence', 'grace'] },
    { id: 'nav-reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" />, action: () => navigate('/reports'), category: 'navigation', roles: ['super_admin', 'hod', 'lecturer'], keywords: ['analytics', 'export', 'clearance', 'roster'] },
    { id: 'nav-audit', label: 'Audit Log', icon: <ClipboardList className="h-4 w-4" />, action: () => navigate('/audit'), category: 'navigation', roles: ['super_admin'], keywords: ['trail', 'history', 'actions'] },
    // Actions
    { id: 'act-sync', label: 'Sync Now', description: 'Push all pending events to server', icon: <RefreshCw className="h-4 w-4" />, action: () => syncNow(), category: 'action', roles: ['super_admin', 'hod', 'lecturer', 'student', 'staff'], keywords: ['upload', 'push', 'network'] },
    { id: 'act-toggle-conn', label: 'Toggle Connection', description: 'Simulate online/offline state', icon: <Wifi className="h-4 w-4" />, action: () => toggleConnection(), category: 'action', roles: ['super_admin', 'hod', 'lecturer', 'student', 'staff'], keywords: ['network', 'offline', 'online'] },
    { id: 'act-sync-modal', label: 'Open Sync Center', description: 'View sync queue and clock integrity', icon: <RefreshCw className="h-4 w-4" />, action: () => openSyncModal(), category: 'action', roles: ['super_admin', 'hod', 'lecturer', 'student', 'staff'], keywords: ['queue', 'pending', 'clock'] },
  ], [navigate, syncNow, toggleConnection, openSyncModal]);

  // Filter by role + query
  const filteredItems = useMemo(() => {
    const roleFiltered = items.filter(item =>
      user && item.roles.includes(user.role)
    );
    if (!query) return roleFiltered;

    const lower = query.toLowerCase();
    return roleFiltered.filter(item =>
      item.label.toLowerCase().includes(lower) ||
      item.description?.toLowerCase().includes(lower) ||
      item.keywords.some(k => k.includes(lower))
    );
  }, [items, user, query]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        setOpen(false);
      }
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Reset index on filter change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  const navigationItems = filteredItems.filter(i => i.category === 'navigation');
  const actionItems = filteredItems.filter(i => i.category === 'action');

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 z-[61] w-full max-w-lg">
        <div className="bg-white rounded-xl shadow-2xl border border-border overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages and actions..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted rounded border border-border">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1">
            {filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results for "{query}"
              </div>
            ) : (
              <>
                {navigationItems.length > 0 && (
                  <>
                    <p className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pages</p>
                    {navigationItems.map((item, i) => {
                      const globalIndex = filteredItems.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => { item.action(); setOpen(false); }}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            'flex items-center gap-3 w-full px-4 py-2 text-left text-sm transition-colors',
                            globalIndex === selectedIndex
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-foreground hover:bg-muted/50'
                          )}
                        >
                          <span className={cn(globalIndex === selectedIndex ? 'text-primary' : 'text-muted-foreground')}>
                            {item.icon}
                          </span>
                          <span className="flex-1">{item.label}</span>
                          {globalIndex === selectedIndex && (
                            <ArrowRight className="h-3 w-3 text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </>
                )}

                {actionItems.length > 0 && (
                  <>
                    <p className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Actions</p>
                    {actionItems.map((item) => {
                      const globalIndex = filteredItems.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => { item.action(); setOpen(false); }}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            'flex items-center gap-3 w-full px-4 py-2 text-left text-sm transition-colors',
                            globalIndex === selectedIndex
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-foreground hover:bg-muted/50'
                          )}
                        >
                          <span className={cn(globalIndex === selectedIndex ? 'text-primary' : 'text-muted-foreground')}>
                            {item.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="block">{item.label}</span>
                            {item.description && (
                              <span className="block text-xs text-muted-foreground">{item.description}</span>
                            )}
                          </div>
                          {globalIndex === selectedIndex && (
                            <ArrowRight className="h-3 w-3 text-primary flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span><kbd className="px-1 py-0.5 bg-white rounded border text-[9px]">↑↓</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 bg-white rounded border text-[9px]">↵</kbd> select</span>
              <span><kbd className="px-1 py-0.5 bg-white rounded border text-[9px]">esc</kbd> close</span>
            </div>
            <span>{filteredItems.length} results</span>
          </div>
        </div>
      </div>
    </>
  );
}
