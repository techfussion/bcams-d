// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '@/components/layout/sidebar';
import { CommandPalette } from '@/components/common/command-palette';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/api';
import { DashboardPage } from '@/pages/dashboard';
import { scannerService } from '@/services/scanner-service';
// @ts-ignore
import tailwindConfig from '../../tailwind.config.js';

describe('BCAMS — Audit Log & Devices Page Removal & Standardized Input Focus Styling', () => {
  beforeEach(async () => {
    await useAuthStore.getState().login('user-sa');
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Audit Log Page & Navigation Removal', () => {
    it('verifies Audit Log is completely absent from Sidebar navigation', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <Sidebar />
        </MemoryRouter>
      );

      // Verify general items exist
      expect(screen.getByText('Dashboard')).toBeTruthy();
      expect(screen.getByText('Reports')).toBeTruthy();

      // Verify Audit Log is not in sidebar
      expect(screen.queryByText('Audit Log')).toBeNull();
    });

    it('verifies Audit Log is absent from Command Palette items', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <CommandPalette />
        </MemoryRouter>
      );

      expect(screen.queryByText('Audit Log')).toBeNull();
    });

    it('redirects former /audit route to dashboard in App router', async () => {
      window.location.hash = '#/audit';

      render(<App />);

      await waitFor(() => {
        expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
      });

      // No Audit Log heading or interface rendered
      expect(screen.queryByRole('heading', { name: /^Audit Log$/i })).toBeNull();
      expect(screen.queryByText('Immutable, tamper-evident audit trail')).toBeNull();
    });

    it('preserves underlying audit logging API and operational records', async () => {
      // Verify audit entries are still accessible for security diagnostics
      const entries = await api.getAuditEntries(10);
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);

      const first = entries[0];
      expect(first.id).toBeTruthy();
      expect(first.action).toBeTruthy();
      expect(first.timestamp).toBeTruthy();
    });
  });

  describe('2. Standardized Neutral Dark-Grey Focus Outline', () => {
    it('verifies tailwind.config.js defines ring token as neutral dark-grey (#334155)', () => {
      expect(tailwindConfig.theme.extend.colors.ring).toBe('#334155');
      // Ensure primary brand color remains green
      expect(tailwindConfig.theme.extend.colors.primary.DEFAULT).toBe('#069162');
    });

    it('applies neutral dark-grey ring classes on Input component without green ring-primary', () => {
      render(<Input placeholder="Test input" />);
      const input = screen.getByPlaceholderText('Test input');

      // Uses ring-ring (resolves to #334155)
      expect(input.className).toContain('focus-visible:ring-ring');
      expect(input.className).toContain('focus:ring-ring');

      // Does NOT contain green ring-primary
      expect(input.className).not.toContain('ring-primary');
    });

    it('preserves distinct validation state on Input component when error is present', () => {
      render(<Input placeholder="Error input" error="Invalid matric number" />);
      const input = screen.getByPlaceholderText('Error input');

      // Error state communicates destructive red
      expect(input.className).toContain('border-destructive');
      expect(input.className).toContain('focus-visible:ring-destructive');
      expect(input.className).toContain('focus:ring-destructive');
      expect(screen.getByText('Invalid matric number')).toBeTruthy();
    });

    it('applies neutral dark-grey ring classes on Textarea component', () => {
      render(<Textarea placeholder="Test notes" />);
      const textarea = screen.getByPlaceholderText('Test notes');

      expect(textarea.className).toContain('focus-visible:ring-ring');
      expect(textarea.className).toContain('focus:ring-ring');
      expect(textarea.className).not.toContain('ring-primary');
    });

    it('applies neutral dark-grey ring classes on SelectTrigger component', () => {
      render(
        <Select>
          <SelectTrigger aria-label="Select test">
            <SelectValue placeholder="Choose option" />
          </SelectTrigger>
        </Select>
      );
      const trigger = screen.getByLabelText('Select test');

      expect(trigger.className).toContain('focus:ring-ring');
      expect(trigger.className).not.toContain('ring-primary');
    });
  });

  describe('3. Devices Page Removal & Preserved Hardware/Gate Workflows', () => {
    it('verifies Trusted Devices is completely absent from Sidebar navigation', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <Sidebar />
        </MemoryRouter>
      );

      expect(screen.queryByText('Trusted Devices')).toBeNull();
      expect(screen.queryByText('Devices')).toBeNull();
    });

    it('verifies Trusted Devices is absent from Command Palette items', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <CommandPalette />
        </MemoryRouter>
      );

      expect(screen.queryByText('Trusted Devices')).toBeNull();
    });

    it('redirects former /devices route to dashboard in App router', async () => {
      window.location.hash = '#/devices';

      render(<App />);

      await waitFor(() => {
        expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
      });

      // No Devices heading or interface rendered
      expect(screen.queryByRole('heading', { name: /^Trusted Devices$/i })).toBeNull();
      expect(screen.queryByText(/Trusted Physical Capture Endpoints/i)).toBeNull();
    });

    it('does not render obsolete Capture Devices card or endpoints indicator on dashboard', async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <DashboardPage />
        </MemoryRouter>
      );

      expect(screen.queryByText('Capture Devices')).toBeNull();
      expect(screen.queryByText(/registered endpoints/i)).toBeNull();
    });

    it('preserves underlying scanner service abstraction and hardware capture capability', async () => {
      expect(scannerService).toBeDefined();
      expect(typeof scannerService.getState).toBe('function');
      expect(typeof scannerService.connect).toBe('function');
      expect(typeof scannerService.startCapture).toBe('function');

      const connected = await scannerService.connect();
      expect(connected).toBe(true);
      expect(scannerService.getState()).toBe('ready');

      const capture = await scannerService.startCapture();
      expect(capture.type).toBe('success');
      if (capture.type === 'success') {
        expect(capture.personId).toBeTruthy();
        expect(capture.timestamp).toBeTruthy();
      }
    });

    it('preserves standalone Gate Terminal clock-in workflow and trusted gate device persistence', async () => {
      // Hardware devices are preserved in data/api for clock events and gate validation
      const devices = await api.getDevices();
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);

      const gateDevice = devices.find(d => d.id === 'dev-gate-01');
      expect(gateDevice).toBeDefined();
      expect(gateDevice?.status).toBe('active');

      // Test staff clock event using trusted gate terminal
      const clockEvent = await api.recordClockEvent({
        staffId: 'stf-001',
        staffName: 'Dr. Adebayo Ogunlesi',
        staffDepartment: 'Computer Science',
        type: 'clock_in',
        deviceId: 'dev-gate-01',
      });

      expect(clockEvent).toBeDefined();
      expect(clockEvent.id).toBeTruthy();
      expect(clockEvent.staffId).toBe('stf-001');
      expect(clockEvent.type).toBe('clock_in');
    });
  });
});

