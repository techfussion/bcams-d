import { describe, it, expect } from 'vitest';
import { scannerService } from '@/services/scanner-service';
import { useAuthStore } from '@/stores/auth-store';

describe('Scanner Service Abstraction', () => {
  it('initializes in ready state upon connection', async () => {
    const connected = await scannerService.connect();
    expect(connected).toBe(true);
    expect(scannerService.getState()).toBe('ready');
  });

  it('performs biometric captures and transitions through states', async () => {
    await scannerService.connect();
    const result = await scannerService.startCapture();
    expect(result).toHaveProperty('type');
    expect(['success', 'duplicate', 'no_match', 'error']).toContain(result.type);
    expect(scannerService.getState()).toBe('ready');
  });
});

describe('Auth Store & Role Boundaries', () => {
  it('supports role switching and identity establishing', async () => {
    const auth = useAuthStore.getState();
    await auth.login('user-sa');
    const stateAfterLogin = useAuthStore.getState();
    expect(stateAfterLogin.isAuthenticated).toBe(true);
    expect(stateAfterLogin.user?.role).toBe('super_admin');
  });
});
