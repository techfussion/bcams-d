/**
 * Audit Filter Toolbar
 * 
 * Reusable filter toolbar for security and administrative audit log queries.
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, Filter, RefreshCw } from 'lucide-react';

interface AuditFilterToolbarProps {
  selectedRole: string;
  onRoleChange: (role: string) => void;
  selectedAction: string;
  onActionChange: (action: string) => void;
  onReset: () => void;
  onExport: () => void;
}

export function AuditFilterToolbar({
  selectedRole,
  onRoleChange,
  selectedAction,
  onActionChange,
  onReset,
  onExport,
}: AuditFilterToolbarProps) {
  return (
    <Card className="shadow-xs">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Filters:</span>
            </div>

            <div className="w-40">
              <Select value={selectedRole} onValueChange={onRoleChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Actor Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="dean">Dean</SelectItem>
                  <SelectItem value="hod">HOD</SelectItem>
                  <SelectItem value="lecturer">Lecturer</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-44">
              <Select value={selectedAction} onValueChange={onActionChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="auth">Authentication</SelectItem>
                  <SelectItem value="enrollment">Biometric Enrollment</SelectItem>
                  <SelectItem value="session">Session Lifecycle</SelectItem>
                  <SelectItem value="device">Device Security</SelectItem>
                  <SelectItem value="policy">Policy Governance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(selectedRole !== 'all' || selectedAction !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="h-8 gap-1.5 text-xs shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export Audit Log
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
