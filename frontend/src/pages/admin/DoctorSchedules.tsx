import React from 'react';
import DoctorsView from '../../components/DoctorsView';

/**
 * DoctorSchedules (Consolidated Wrapper)
 * =====================================
 * Consultant Schedules has been consolidated into Doctor Directory -> Doctor Shift Schedules.
 * This wrapper forwards directly to DoctorsView with initialTab="schedules" to maintain
 * backwards compatibility for any direct imports or route references.
 */
const DoctorSchedules: React.FC = () => {
  return <DoctorsView initialTab="schedules" />;
};

export default DoctorSchedules;
