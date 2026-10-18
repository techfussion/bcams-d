/**
 * Departments Page (Deprecated)
 * Consolidated into Academia Hub (/academic/academia)
 */
import React from 'react';
import { Navigate } from 'react-router-dom';

export function DepartmentsPage() {
  return <Navigate to="/academic/academia" replace />;
}
