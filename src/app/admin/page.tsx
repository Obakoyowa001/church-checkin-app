import AdminDashboard from '@/components/AdminDashboard';

// Auth is enforced by src/middleware.ts before this ever renders.
export default function AdminPage() {
  return <AdminDashboard />;
}
