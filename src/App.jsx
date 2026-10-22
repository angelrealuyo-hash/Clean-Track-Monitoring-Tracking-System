import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import RequireRole from './auth/RequireRole.jsx'
import PortalChooser from './pages/PortalChooser.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

import AdminLayout from './admin/components/AdminLayout.jsx'
import ResidentLayout from './resident/components/ResidentLayout.jsx'
import DriverLayout from './driver/components/DriverLayout.jsx'
import PageLoader from './components/PageLoader.jsx'

// Each page is downloaded the first time it is opened (keeps the first load
// small; the map library only loads with the pages that show a map).
const Admin = {
  LoginPage: lazy(() => import('./admin/pages/LoginPage.jsx')),
  DashboardPage: lazy(() => import('./admin/pages/DashboardPage.jsx')),
  LiveTrackingPage: lazy(() => import('./admin/pages/LiveTrackingPage.jsx')),
  TruckPage: lazy(() => import('./admin/pages/TruckPage.jsx')),
  DriverManagementPage: lazy(() => import('./admin/pages/DriverManagementPage.jsx')),
  RoutesSchedulesPage: lazy(() => import('./admin/pages/RoutesSchedulesPage.jsx')),
  CollectionMonitoringPage: lazy(() => import('./admin/pages/CollectionMonitoringPage.jsx')),
  ResidentReportsPage: lazy(() => import('./admin/pages/ResidentReportsPage.jsx')),
  NotificationsPage: lazy(() => import('./admin/pages/NotificationsPage.jsx')),
  ReportsAnalyticsPage: lazy(() => import('./admin/pages/ReportsAnalyticsPage.jsx')),
  SettingsPage: lazy(() => import('./admin/pages/SettingsPage.jsx')),
}
const Resident = {
  LoginPage: lazy(() => import('./resident/pages/LoginPage.jsx')),
  CreateAccountPage: lazy(() => import('./resident/pages/CreateAccountPage.jsx')),
  HomePage: lazy(() => import('./resident/pages/HomePage.jsx')),
  TrackTruckPage: lazy(() => import('./resident/pages/TrackTruckPage.jsx')),
  SchedulePage: lazy(() => import('./resident/pages/SchedulePage.jsx')),
  ReportProblemPage: lazy(() => import('./resident/pages/ReportProblemPage.jsx')),
  MyReportsPage: lazy(() => import('./resident/pages/MyReportsPage.jsx')),
  ReportDetailPage: lazy(() => import('./resident/pages/ReportDetailPage.jsx')),
  NotificationsPage: lazy(() => import('./resident/pages/NotificationsPage.jsx')),
  ProfilePage: lazy(() => import('./resident/pages/ProfilePage.jsx')),
}
const Driver = {
  LoginPage: lazy(() => import('./driver/pages/LoginPage.jsx')),
  HomePage: lazy(() => import('./driver/pages/HomePage.jsx')),
  MyRoutePage: lazy(() => import('./driver/pages/MyRoutePage.jsx')),
  CollectionPage: lazy(() => import('./driver/pages/CollectionPage.jsx')),
  NotificationsPage: lazy(() => import('./driver/pages/NotificationsPage.jsx')),
  ProfilePage: lazy(() => import('./driver/pages/ProfilePage.jsx')),
}

// All pages in CleanTrack. Each app has its own login and is protected
// by RequireRole, so you must sign in to that app to see its pages.
export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<PortalChooser />} />

        {/* Admin Website */}
        <Route path="/admin/login" element={<Admin.LoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireRole role="admin">
              <AdminLayout />
            </RequireRole>
          }
        >
          <Route index element={<Admin.DashboardPage />} />
          <Route path="live-tracking" element={<Admin.LiveTrackingPage />} />
          <Route path="truck" element={<Admin.TruckPage />} />
          <Route path="drivers" element={<Admin.DriverManagementPage />} />
          <Route path="routes" element={<Admin.RoutesSchedulesPage />} />
          <Route path="collection" element={<Admin.CollectionMonitoringPage />} />
          <Route path="resident-reports" element={<Admin.ResidentReportsPage />} />
          <Route path="notifications" element={<Admin.NotificationsPage />} />
          <Route path="analytics" element={<Admin.ReportsAnalyticsPage />} />
          <Route path="settings" element={<Admin.SettingsPage />} />
        </Route>

        {/* Resident App */}
        <Route path="/resident/login" element={<Resident.LoginPage />} />
        <Route path="/resident/register" element={<Resident.CreateAccountPage />} />
        <Route
          path="/resident"
          element={
            <RequireRole role="resident">
              <ResidentLayout />
            </RequireRole>
          }
        >
          <Route index element={<Resident.HomePage />} />
          <Route path="track" element={<Resident.TrackTruckPage />} />
          <Route path="schedule" element={<Resident.SchedulePage />} />
          <Route path="reports" element={<Resident.MyReportsPage />} />
          <Route path="reports/new" element={<Resident.ReportProblemPage />} />
          <Route path="reports/:reportId" element={<Resident.ReportDetailPage />} />
          <Route path="notifications" element={<Resident.NotificationsPage />} />
          <Route path="profile" element={<Resident.ProfilePage />} />
        </Route>

        {/* Driver App */}
        <Route path="/driver/login" element={<Driver.LoginPage />} />
        <Route
          path="/driver"
          element={
            <RequireRole role="driver">
              <DriverLayout />
            </RequireRole>
          }
        >
          <Route index element={<Driver.HomePage />} />
          <Route path="route" element={<Driver.MyRoutePage />} />
          <Route path="collection" element={<Driver.CollectionPage />} />
          <Route path="notifications" element={<Driver.NotificationsPage />} />
          <Route path="profile" element={<Driver.ProfilePage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
