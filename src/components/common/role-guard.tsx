/**
 * Role & Capability Guard
 * 
 * Guards routes and page action sections against unauthorized role access.
 * Enforces: Role -> Capability -> Scope -> Allowed UI
 */
import React from 'react';
import { useAuthStore } from '@/stores/auth-store';
import type { UserRole, CaptureCapability } from '@/types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface RoleGuardProps {
  children: React.ReactNode;
  roles?: UserRole[];
  capabilities?: CaptureCapability[];
  can?: boolean;
  fallback?: React.ReactNode;
}

export function RoleGuard({
  children,
  roles,
  capabilities,
  can,
  fallback,
}: RoleGuardProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  let isAuthorized = true;

  if (typeof can === 'boolean') {
    isAuthorized = isAuthorized && can;
  }

  if (roles && roles.length > 0) {
    const roleMatches = user?.role ? roles.includes(user.role) : false;
    isAuthorized = isAuthorized && roleMatches;
  }

  if (capabilities && capabilities.length > 0) {
    const capabilityMatches = user?.captureCapability ? capabilities.includes(user.captureCapability) : false;
    isAuthorized = isAuthorized && capabilityMatches;
  }

  if (isAuthorized) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-fade-in">
      <div className="h-16 w-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-200">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        Your current account role ({user?.role?.replace('_', ' ') || 'unauthenticated'}) does not have permission to access this module or operational workspace.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
        <Button variant="default" size="sm" onClick={() => navigate('/')}>
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}

interface ActionGuardProps {
  can: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ActionGuard({ can, children, fallback = null }: ActionGuardProps) {
  if (!can) return <>{fallback}</>;
  return <>{children}</>;
}
