import {
  Bell,
  ChartColumn,
  ClipboardCheck,
  Contact,
  LayoutDashboard,
  MapPin,
  Route,
  Settings,
  TriangleAlert,
  Truck,
} from 'lucide-react'

// Sidebar items, grouped as in the PDF (pages 3-4).
// `badge` names a count that AdminLayout fills in.
export const adminNavGroups = [
  [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/live-tracking', label: 'Live Tracking', icon: MapPin },
    { to: '/admin/truck', label: 'Truck Management', icon: Truck, badge: 'truck' },
    { to: '/admin/drivers', label: 'Driver Management', icon: Contact },
    { to: '/admin/routes', label: 'Routes & Schedules', icon: Route },
    { to: '/admin/collection', label: 'Collection Monitoring', icon: ClipboardCheck },
  ],
  [
    { to: '/admin/resident-reports', label: 'Resident Reports', icon: TriangleAlert, badge: 'reports' },
    { to: '/admin/notifications', label: 'Notifications', icon: Bell, badge: 'notifications' },
    { to: '/admin/analytics', label: 'Reports & Analytics', icon: ChartColumn },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ],
]

export function findNavItem(pathname) {
  const items = adminNavGroups.flat()
  return (
    items.find((i) => i.end && pathname === i.to) ||
    items.find((i) => !i.end && pathname.startsWith(i.to))
  )
}
