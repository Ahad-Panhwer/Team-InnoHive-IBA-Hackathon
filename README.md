# CareLink Emergency Coordination Network

A full-stack emergency coordination demo for ambulance teams, hospital staff, doctors, and network administrators. Express serves the role-based web app and JSON API; SQLite stores users, hospitals, resources, doctors, ambulances, emergencies, transfers, messages, audit events, and offline sync records. Socket.IO broadcasts network updates. The interface includes an offline action queue and cached hospital data.

## Run locally

1. Install Node.js 24.15 or newer (the app uses Node's built-in SQLite support).
2. In this folder, run `npm install`.
3. Run `npm start` and open [http://localhost:3000](http://localhost:3000).

On first start the server creates and seeds `database/emergency.db`. Alternatively, run `npm run init-db` first. Demo records are fictional availability snapshots and are intended for demonstration only.

## Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Ambulance driver | `driver` | `driver` |
| Hospital staff | `hospital` | `hospital` |
| Doctor | `doctor` | `doctor` |
| Network admin | `admin` | `admin` |

The UI signs into these seeded demo accounts when switching roles. Replace demo accounts, credentials, and `JWT_SECRET` before any deployment. This prototype is not a clinical decision system and should not receive real patient data.

## Integrations and limits

- Leaflet maps use OpenStreetMap tiles when internet access is available; hospital matching and the local application continue to work with cached data while offline.
- Socket.IO delivers emergency and resource updates to connected clients. Reconnecting clients reload the latest server state.
- Offline emergency actions are stored in browser local storage and submitted when connectivity returns. Keep the browser profile and device available until the sync completes.
- Routing ETA is a straight-line distance estimate at a demo average speed. It is not live traffic routing.
- Hospital records, capacity, and staff availability are sample data. The deployable system still needs verified provider onboarding, production identity management, consent and retention controls, and a production routing/notification provider.

## Main API groups

`/api/auth`, `/api/hospitals`, `/api/emergencies`, `/api/doctors`, `/api/ambulances`, `/api/messages`, `/api/transfers`, `/api/admin`, and `/api/sync`. API routes use bearer tokens returned by `POST /api/auth/login`. `GET /api/health` reports server status.
