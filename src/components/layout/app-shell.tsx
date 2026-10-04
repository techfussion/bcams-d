/**
 * BCAMS Application Shell
 * 
 * Main layout with sidebar + header + scrollable content area.
 * Includes global providers: Toaster, CommandPalette, SyncCenterModal.
 */
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { SyncCenterModal } from '@/components/common/sync-modal';
import { Toaster } from '@/components/common/toaster';
import { CommandPalette } from '@/components/common/command-palette';
import { ErrorBoundary } from '@/components/common/error-boundary';

export function AppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Page content (each page provides its own Header + content) */}
        <div className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {/* Global overlays */}
      <SyncCenterModal />
      <Toaster />
      <CommandPalette />
    </div>
  );
}
