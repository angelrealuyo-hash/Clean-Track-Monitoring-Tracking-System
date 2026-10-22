// Every change to the demo data goes through here.
const now = () => new Date().toISOString()

export function nextId(prefix, items, width = 2) {
  const max = items.reduce((m, it) => {
    const n = Number(String(it.id).split('-').pop())
    return Number.isFinite(n) && n > m ? n : m
  }, 0)
  return `${prefix}-${String(max + 1).padStart(width, '0')}`
}

export function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase())
    .slice(0, 2)
    .join('')
}

function addNotification(state, n) {
  const notification = {
    id: nextId('N', state.notifications, 3),
    read: false,
    time: now(),
    priority: 'low',
    ...n,
  }
  return [notification, ...state.notifications]
}

export function dataReducer(state, action) {
  const p = action.payload
  switch (action.type) {
    case 'truck/update':
      return { ...state, truck: { ...state.truck, ...p } }

    case 'truck/assignDriver':
      return { ...state, truck: { ...state.truck, driverId: p.driverId } }

    case 'truck/logMaintenance': {
      const record = { date: p.date, type: p.type, odometerKm: p.odometerKm, notes: p.notes }
      return {
        ...state,
        truck: {
          ...state.truck,
          odometerKm: Math.max(state.truck.odometerKm, p.odometerKm),
          status: p.newStatus,
          maintenance: [record, ...state.truck.maintenance],
          nextServiceDate: p.nextServiceDate || state.truck.nextServiceDate,
        },
      }
    }

    case 'driver/add': {
      const driver = { ...p, id: nextId('DRV', state.drivers), initials: initials(p.name) }
      return { ...state, drivers: [...state.drivers, driver] }
    }

    case 'driver/update':
      return {
        ...state,
        drivers: state.drivers.map((d) =>
          d.id === p.id ? { ...d, ...p.patch, ...(p.patch.name ? { initials: initials(p.patch.name) } : {}) } : d,
        ),
      }

    case 'driver/delete':
      return {
        ...state,
        drivers: state.drivers.filter((d) => d.id !== p.id),
        // A deleted driver can no longer drive the truck.
        truck: state.truck.driverId === p.id ? { ...state.truck, driverId: null } : state.truck,
      }

    case 'route/update':
      return { ...state, route: { ...state.route, ...p } }

    case 'route/updateStop':
      return {
        ...state,
        route: {
          ...state.route,
          stops: state.route.stops.map((s) => (s.id === p.id ? { ...s, ...p.patch } : s)),
        },
      }

    case 'schedule/update':
      return {
        ...state,
        weeklySchedule: state.weeklySchedule.map((d) => (d.day === p.day ? { ...d, ...p.patch } : d)),
      }

    case 'collection/mark':
      return {
        ...state,
        collectionLog: { ...state.collectionLog, [p.stopId]: { status: p.status, note: p.note || '', at: now() } },
      }

    case 'collection/clear': {
      const log = { ...state.collectionLog }
      delete log[p.stopId]
      return { ...state, collectionLog: log }
    }

    case 'collection/clearAll':
      return { ...state, collectionLog: {} }

    case 'report/update': {
      const report = state.reports.find((r) => r.id === p.id)
      if (!report) return state
      const entries = []
      if (p.status && p.status !== report.status) {
        entries.push({ at: now(), text: `Status changed to ${p.statusLabel ?? p.status}` })
      }
      if (p.adminResponse !== undefined && p.adminResponse !== report.adminResponse) {
        entries.push({ at: now(), text: 'Barangay response updated' })
      }
      if (entries.length === 0) return state
      const updated = {
        ...report,
        ...(p.status ? { status: p.status } : {}),
        ...(p.adminResponse !== undefined ? { adminResponse: p.adminResponse } : {}),
        history: [...report.history, ...entries],
      }
      return {
        ...state,
        reports: state.reports.map((r) => (r.id === p.id ? updated : r)),
        // Let the resident know in their app.
        notifications: addNotification(state, {
          audience: 'resident',
          residentId: report.residentId,
          priority: 'medium',
          title: `Update on report ${report.id}`,
          body: updated.adminResponse || `Your report is now ${p.statusLabel ?? updated.status}.`,
          link: { label: 'View Report', to: `/resident/reports/${report.id}` },
        }),
      }
    }

    case 'notification/markRead':
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === p.id ? { ...n, read: true } : n)),
      }

    case 'notification/markAllRead':
      // Either every notification for an audience, or a given list of ids.
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          (p.ids ? p.ids.includes(n.id) : n.audience === p.audience) ? { ...n, read: true } : n,
        ),
      }

    case 'resident/add': {
      const num = p.id.split('-').pop()
      const resident = {
        ...p,
        initials: initials(p.name),
        householdId: `HH-SANANTONIO-${num}`,
        prefs: { email: true, push: true, scheduleReminders: true, truckNearby: true },
        createdAt: now(),
      }
      return { ...state, residents: [...state.residents, resident] }
    }

    case 'resident/update':
      return {
        ...state,
        residents: state.residents.map((r) =>
          r.id === p.id ? { ...r, ...p.patch, ...(p.patch.name ? { initials: initials(p.patch.name) } : {}) } : r,
        ),
      }

    case 'report/add': {
      const year = new Date().getFullYear()
      const report = {
        ...p,
        id: p.id ?? nextId(`REP-${year}`, state.reports, 3),
        status: 'submitted',
        submittedAt: now(),
        adminResponse: null,
        history: [{ at: now(), text: 'Report submitted by resident' }],
      }
      return {
        ...state,
        reports: [report, ...state.reports],
        notifications: addNotification(state, {
          audience: 'admin',
          priority: p.category === 'missed' || p.category === 'no-truck' ? 'high' : 'medium',
          title: `New resident report ${report.id}`,
          body: `${p.categoryLabel} at ${p.location}.`,
          link: { label: `Open report ${report.id}`, to: `/admin/resident-reports?id=${report.id}` },
        }),
      }
    }

    case 'driver/reportIssue': {
      let next = state
      if (p.notifyDispatch) {
        next = {
          ...next,
          notifications: addNotification(next, {
            audience: 'admin',
            priority: 'high',
            title: `Driver issue at ${p.stopName}: ${p.issueLabel}`,
            body: `${p.driverName}: ${p.description}`,
            photo: p.photo ?? null,
            link: { label: 'Open Collection Monitoring', to: '/admin/collection' },
          }),
        }
      }
      if (p.markMissed) {
        next = {
          ...next,
          collectionLog: {
            ...next.collectionLog,
            [p.stopId]: { status: 'missed', note: `${p.issueLabel} — ${p.description} (reported by driver)`, at: now() },
          },
        }
      }
      return next
    }

    // Another browser tab saved newer data. Keep unchanged parts as the same
    // objects so, e.g., a running simulation is not restarted needlessly.
    case 'sync': {
      const merged = { ...p }
      for (const key of Object.keys(p)) {
        if (JSON.stringify(state[key]) === JSON.stringify(p[key])) merged[key] = state[key]
      }
      return merged
    }

    case 'broadcast/add': {
      const broadcast = { id: nextId('B', state.broadcasts), sentAt: now(), ...p }
      return {
        ...state,
        broadcasts: [broadcast, ...state.broadcasts],
        notifications: addNotification(state, {
          audience: 'resident',
          priority: 'medium',
          title: p.subject,
          body: p.message,
          zone: p.zone,
          kind: 'advisory',
        }),
      }
    }

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...p }, savedAt: now() }

    case 'reset':
      return p

    default:
      throw new Error(`Unknown data action: ${action.type}`)
  }
}
