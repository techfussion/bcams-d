/**
 * API Provider
 * 
 * Single entry point for the API. Currently returns the mock adapter.
 * When the real backend is ready, switch the import here.
 */
import { mockApi } from './mock-adapter';
import type { BcamsApi } from './types';

export const api: BcamsApi = mockApi;

export { setMockUser } from './mock-adapter';
export type { BcamsApi } from './types';
