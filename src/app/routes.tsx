import React from 'react';
import { createBrowserRouter, Navigate, useParams } from 'react-router';
import { MainLayout } from './components/layout/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { AssignmentDetailPage } from './pages/AssignmentDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { AdminPage } from './pages/AdminPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { VendorPortalPage } from './pages/VendorPortalPage';
import { ReportingPage } from './pages/ReportingPage';
import { StockInventoryPage } from './pages/StockInventoryPage';
import { PrinterIncidentsPage } from './pages/PrinterIncidentsPage';
import { LicencesPage } from './pages/LicencesPage';
import PdfHistoryPage from './pages/PdfHistoryPage';
import { useAuth } from './context/AuthContext';
import type { UserRole } from './types';

function InventoryAssetRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/stock-inventory/${id}` : '/stock-inventory'} replace />;
}

function RequireRole({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user } = useAuth();
  const role = user?.role ?? 'Reader';

  if (!roles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: LoginPage,
  },
  {
    path: '/',
    Component: MainLayout,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        Component: DashboardPage,
      },
      {
        path: 'inventory',
        element: <Navigate to="/stock-inventory" replace />
      },
      {
        path: 'inventory/:id',
        Component: InventoryAssetRedirect
      },
      {
        path: 'movements',
        element: <Navigate to="/stock-inventory" replace />
      },
      {
        path: 'stock-inventory',
        Component: StockInventoryPage
      },
      {
        path: 'stock-inventory/:id',
        Component: AssetDetailPage
      },
      {
        path: 'printer-incidents',
        Component: PrinterIncidentsPage
      },
      {
        path: 'assignments',
        Component: AssignmentsPage
      },
      {
        path: 'assignments/:id',
        Component: AssignmentDetailPage
      },
      {
        path: 'orders',
        element: (
          <RequireRole roles={['Admin', 'Manager']}>
            <OrdersPage />
          </RequireRole>
        )
      },
      {
        path: 'maintenance',
        Component: MaintenancePage
      },
      {
        path: 'admin',
        element: (
          <RequireRole roles={['Admin']}>
            <AdminPage />
          </RequireRole>
        )
      },
      {
        path: 'audit-logs',
        element: (
          <RequireRole roles={['Admin']}>
            <AuditLogsPage />
          </RequireRole>
        )
      },
      {
        path: 'vendor-portal',
        element: (
          <RequireRole roles={['Admin', 'Manager']}>
            <VendorPortalPage />
          </RequireRole>
        )
      },
      {
        path: 'reporting',
        Component: ReportingPage
      },
      {
        path: 'licences',
        Component: LicencesPage
      },
      {
        path: 'pdf-history',
        Component: PdfHistoryPage
      }
    ]
  }
]);
