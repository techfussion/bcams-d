/**
 * BCAMS Academia Page
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DepartmentsTab } from './departments-tab';
import { PoliciesTab } from './policies-tab';
import { CapturersTab } from './capturers-tab';
import { SessionsProgressionTab } from './sessions-progression-tab';
import { StatCardSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Department, Staff, Student, Policy, AcademicSession } from '@/types';
import {
  Building2, ShieldCheck, Fingerprint, Calendar,
  Sparkles,
} from 'lucide-react';

export function AcademiaPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('departments');
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [academicSessions, setAcademicSessions] = useState<AcademicSession[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [allDepts, allStaff, allStudents, allPolicies, allSessions] = await Promise.all([
        api.getDepartments(),
        api.getStaff(),
        api.getStudents(),
        api.getPolicies(),
        api.getAcademicSessions(),
      ]);
      setDepartments(allDepts);
      setStaff(allStaff);
      setStudents(allStudents);
      setPolicies(allPolicies);
      setAcademicSessions(allSessions);
    } catch (err) {
      console.error('Failed to load Academia domain data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Academia"
      />

      <div className="flex-1 p-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-100 p-1 rounded-xl h-auto flex flex-wrap gap-1 border border-border/60">
            <TabsTrigger
              value="departments"
              className="gap-2 py-2 px-3.5 text-xs font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-2xs"
            >
              Departments & HODs
              <span className="ml-1 text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 text-muted-foreground font-mono">
                {departments.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="policies"
              className="gap-2 py-2 px-3.5 text-xs font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-2xs"
            >
              Attendance Policies & Geofence
            </TabsTrigger>

            <TabsTrigger
              value="capturers"
              className="gap-2 py-2 px-3.5 text-xs font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-2xs"
            >
              Session Capturers
              <span className="ml-1 text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 text-muted-foreground font-mono">
                {students.filter(s => s.captureCapability === 'session_capture').length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="sessions_progression"
              className="gap-2 py-2 px-3.5 text-xs font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-2xs"
            >
              Sessions & Progression
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : (
            <>
              <TabsContent value="departments" className="mt-0 focus-visible:outline-none">
                <DepartmentsTab
                  departments={departments}
                  staff={staff}
                  onRefresh={loadData}
                />
              </TabsContent>

              <TabsContent value="policies" className="mt-0 focus-visible:outline-none">
                <PoliciesTab
                  policies={policies}
                  onRefresh={loadData}
                />
              </TabsContent>

              <TabsContent value="capturers" className="mt-0 focus-visible:outline-none">
                <CapturersTab
                  students={students}
                  departments={departments}
                  onRefresh={loadData}
                />
              </TabsContent>

              <TabsContent value="sessions_progression" className="mt-0 focus-visible:outline-none">
                <SessionsProgressionTab
                  sessions={academicSessions}
                  students={students}
                  onRefresh={loadData}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}

export default AcademiaPage;
