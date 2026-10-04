/**
 * Attendance Capture Stats Bar
 * 
 * Real-time capture metrics showing verified count, expected roster,
 * scanner match status, and geofence verification indicator.
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Fingerprint, Users, MapPin, ShieldCheck } from 'lucide-react';

interface CaptureStatsProps {
  attendanceCount: number;
  enrolledCount: number;
  scannerConnected: boolean;
  geofenceValid: boolean;
  courseCode: string;
}

export function CaptureStats({
  attendanceCount,
  enrolledCount,
  scannerConnected,
  geofenceValid,
  courseCode,
}: CaptureStatsProps) {
  const percentage = enrolledCount > 0 ? Math.round((attendanceCount / enrolledCount) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Verified Attendance
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-foreground">{attendanceCount}</span>
              <span className="text-xs text-muted-foreground">of {enrolledCount} ({percentage}%)</span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-primary-50 text-primary flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Biometric Sensor
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  scannerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'
                }`}
              />
              <span className="text-xs font-semibold text-foreground">
                {scannerConnected ? 'Ready for Touch' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Fingerprint className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Geofence Verification
            </p>
            <div className="mt-1">
              {geofenceValid ? (
                <Badge variant="success" className="text-[11px] gap-1">
                  <ShieldCheck className="h-3 w-3" /> Within Perimeter
                </Badge>
              ) : (
                <Badge variant="warning" className="text-[11px] gap-1">
                  <MapPin className="h-3 w-3" /> Out of Perimeter
                </Badge>
              )}
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <MapPin className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Active Course
            </p>
            <p className="text-base font-bold text-foreground mt-1 truncate max-w-[120px]">
              {courseCode}
            </p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
