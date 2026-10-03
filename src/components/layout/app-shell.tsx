/**
 * BCAMS Application Shell
 * 
 * Main layout with sidebar + header + scrollable content area.
 */
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { SyncCenterModal } from '@/components/common/sync-modal';

export function AppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Page content (each page provides its own Header + content) */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Global Sync & Clock Integrity Modal */}
      <SyncCenterModal />
    </div>
  );
}
