/**
 * API Provider
 * 
 * Single entry point for the API.
 * Defaults to mockApi for offline development and testing.
 * Switches to httpApi when VITE_USE_MOCK_API is 'false' or configured dynamically.
 */
import { mockApi, setMockUser } from './mock-adapter';
import { httpApi, HttpApiAdapter, ApiError } from './http-adapter';
import type { BcamsApi } from './types';

// Detect whether we should default to real HTTP or Mock adapter
const useMock = typeof import.meta !== 'undefined' 
  ? import.meta.env?.VITE_USE_MOCK_API !== 'false' 
  : true;

let activeApi: BcamsApi = useMock ? mockApi : httpApi;

export const api: BcamsApi = new Proxy({} as BcamsApi, {
  get(_, prop: keyof BcamsApi) {
    return (...args: any[]) => {
      const fn = (activeApi as any)[prop];
      if (typeof fn === 'function') {
        return fn.apply(activeApi, args);
      }
      return Reflect.get(activeApi, prop);
    };
  },
});

export const setApiMode = (mode: 'mock' | 'http'): void => {
  activeApi = mode === 'http' ? httpApi : mockApi;
};

export const getApiMode = (): 'mock' | 'http' => {
  return activeApi === httpApi ? 'http' : 'mock';
};

export { mockApi, httpApi, HttpApiAdapter, ApiError, setMockUser };
export type { BcamsApi } from './types';
