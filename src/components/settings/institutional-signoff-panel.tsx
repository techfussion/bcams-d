/**
 * Institutional Sign-Off & HOD Signature Settings Panel
 * 
 * Allows configuring the official HOD identity, academic credentials, and
 * uploading a custom signature image (PNG, JPG, SVG) with transparent background
 * or reverting to the institutional cursive SVG fallback.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  getHodSignoffData,
  saveHodSignoffData,
  resetHodSignoffData,
  DEFAULT_SVG_SIGNATURE,
  DEFAULT_SVG_STAMP,
  type HodSignoffData,
} from '@/lib/hod-signature-store';
import {
  PenTool,
  Upload,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Building2,
  Sparkles,
  Info,
  ShieldCheck,
  Award,
} from 'lucide-react';

export function InstitutionalSignoffPanel() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [signoffData, setSignoffData] = useState<HodSignoffData>(getHodSignoffData);
  const [hodName, setHodName] = useState(signoffData.hodName);
  const [hodTitle, setHodTitle] = useState(signoffData.hodTitle);
  const [departmentName, setDepartmentName] = useState(signoffData.departmentName);
  const [facultyName, setFacultyName] = useState(signoffData.facultyName);
  const [institutionName, setInstitutionName] = useState(signoffData.institutionName);
  const [academicSession, setAcademicSession] = useState(signoffData.academicSession);
  const [semester, setSemester] = useState(signoffData.semester);
  const [signatureImage, setSignatureImage] = useState(signoffData.signatureImage);
  const [stampImage, setStampImage] = useState(signoffData.stampImage);
  const [hasCustomSignature, setHasCustomSignature] = useState(
    signoffData.signatureImage !== DEFAULT_SVG_SIGNATURE
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<HodSignoffData>;
      if (customEvent.detail) {
        setSignoffData(customEvent.detail);
        setHodName(customEvent.detail.hodName);
        setHodTitle(customEvent.detail.hodTitle);
        setDepartmentName(customEvent.detail.departmentName);
        setFacultyName(customEvent.detail.facultyName);
        setInstitutionName(customEvent.detail.institutionName);
        setAcademicSession(customEvent.detail.academicSession);
        setSemester(customEvent.detail.semester);
        setSignatureImage(customEvent.detail.signatureImage);
        setStampImage(customEvent.detail.stampImage);
        setHasCustomSignature(customEvent.detail.signatureImage !== DEFAULT_SVG_SIGNATURE);
      }
    };

    window.addEventListener('bcams:hod-signoff-updated', handleUpdate);
    return () => window.removeEventListener('bcams:hod-signoff-updated', handleUpdate);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large', 'Please choose an image under 2MB.');
      return;
    }

    // Validate format
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'].includes(file.type)) {
      toast.error('Invalid format', 'Please upload a PNG, JPG, or SVG file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        setSignatureImage(result);
        setHasCustomSignature(true);
        toast.success('Signature image loaded', 'Click "Save Sign-Off Details" to apply changes.');
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleResetToDefault = () => {
    setSignatureImage(DEFAULT_SVG_SIGNATURE);
    setHasCustomSignature(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.info('Default signature restored', 'Using institutional cursive fountain ink signature.');
  };

  const handleSaveAll = () => {
    setIsSaving(true);
    try {
      saveHodSignoffData({
        hodName,
        hodTitle,
        departmentName,
        facultyName,
        institutionName,
        academicSession,
        semester,
        signatureImage,
        stampImage,
      });

      toast.success(
        'Institutional sign-off saved',
        'Official signature and department details updated. Clearance passes will reflect this immediately.'
      );
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFullReset = () => {
    const def = resetHodSignoffData();
    setHodName(def.hodName);
    setHodTitle(def.hodTitle);
    setDepartmentName(def.departmentName);
    setFacultyName(def.facultyName);
    setInstitutionName(def.institutionName);
    setAcademicSession(def.academicSession);
    setSemester(def.semester);
    setSignatureImage(def.signatureImage);
    setStampImage(def.stampImage);
    setHasCustomSignature(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.info('Reset all fields', 'All institutional sign-off values reset to defaults.');
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                <PenTool className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Institutional Sign-Off & Official Clearance Signature</CardTitle>
                <CardDescription className="text-xs">
                  Configure the authoritative Head of Department (HOD) credentials and signature endorsed on all Student Examination Clearance Passes.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1.5 px-2.5 py-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              Active in Clearance Engine
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Institutional Credentials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-foreground">HOD Full Name & Post-Nominals</label>
              <Input
                value={hodName}
                onChange={(e) => setHodName(e.target.value)}
                placeholder="e.g. Dr. A. B. Adeleke, Ph.D."
                className="mt-1.5 text-xs h-9"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Printed directly beneath the endorsed signature block.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Designation & Official Title</label>
              <Input
                value={hodTitle}
                onChange={(e) => setHodTitle(e.target.value)}
                placeholder="e.g. Head of Department"
                className="mt-1.5 text-xs h-9"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Designation appended on statutory attestation footer.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Department Name</label>
              <Input
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                placeholder="e.g. Department of Computer Science"
                className="mt-1.5 text-xs h-9"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Faculty / College Name</label>
              <Input
                value={facultyName}
                onChange={(e) => setFacultyName(e.target.value)}
                placeholder="e.g. College of Natural & Applied Sciences"
                className="mt-1.5 text-xs h-9"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Academic Session</label>
              <Input
                value={academicSession}
                onChange={(e) => setAcademicSession(e.target.value)}
                placeholder="e.g. 2026/2027 Academic Session"
                className="mt-1.5 text-xs h-9"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Semester</label>
              <Input
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="e.g. First Semester"
                className="mt-1.5 text-xs h-9"
              />
            </div>
          </div>

          {/* Signature Upload & Live Preview Section */}
          <div className="border-t border-border pt-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-primary" />
              Official Endorsement Signature & Departmental Stamp
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Left Column: Upload Controls & Notes */}
              <div className="md:col-span-6 space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2 text-xs text-slate-700">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Transparent PNG / SVG Recommended</p>
                      <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                        For crisp, professional clearance passes and seamless overlay with the official stamp, upload a signature with a transparent background. Max file size: 2MB.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2 text-xs h-8 bg-white"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload New Signature
                    </Button>

                    {hasCustomSignature && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetToDefault}
                        className="gap-1.5 text-xs h-8 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Use Default Signature
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Active Signature Status:</span>
                  {hasCustomSignature ? (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px]">
                      Custom Uploaded Asset
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
                      Institutional Vector Signature (Fountain Pen Blue)
                    </Badge>
                  )}
                </div>
              </div>

              {/* Right Column: Live Pass Preview Card */}
              <div className="md:col-span-6">
                <div className="border border-slate-300 rounded-lg p-4 bg-white shadow-sm relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <span className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                      Live Pass Sign-Off Preview
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 font-serif italic mb-2">
                    "Certified compliant with statutory examination requirements:"
                  </p>

                  <div className="relative h-28 flex items-center justify-between border-b border-slate-200 pb-1">
                    {/* Official Stamp Overlay */}
                    <div className="absolute right-6 top-1 w-24 h-24 pointer-events-none opacity-85 select-none z-10">
                      <img
                        src={stampImage}
                        alt="Official Institutional Stamp"
                        className="w-full h-full object-contain filter drop-shadow-sm"
                      />
                    </div>

                    {/* Active Signature Graphic */}
                    <div className="relative z-0 max-w-[220px] h-20 flex items-center">
                      <img
                        src={signatureImage}
                        alt="HOD Endorsement Signature"
                        className="max-h-20 max-w-full object-contain filter contrast-125"
                      />
                    </div>
                  </div>

                  {/* Sign-Off Metadata Typography */}
                  <div className="pt-2">
                    <p className="text-xs font-bold text-slate-900 tracking-wide">{hodName || 'Dr. A. B. Adeleke, Ph.D.'}</p>
                    <p className="text-[11px] text-slate-600 font-medium">{hodTitle || 'Head of Department'}</p>
                    <p className="text-[10px] text-slate-500">{departmentName || 'Department of Computer Science'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleFullReset}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset All Sign-Off Defaults
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="gap-2 bg-primary hover:bg-primary-600 text-white text-xs font-semibold px-4"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSaving ? 'Saving Changes...' : 'Save Sign-Off Details'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

