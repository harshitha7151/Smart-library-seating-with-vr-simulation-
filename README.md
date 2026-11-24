# SeatSpace

SeatSpace is the existing React and Vite app for RVCE library seating. It currently implements only the approved 3rd-floor library. The map is built from real Three.js geometry and offers a directly overhead orthographic view plus an angled 3D view.

## Project structure

- src/scene3DData.js — third-floor coordinates and data for areas, walls, doors, tables, seats, shelves, plants and furniture.
- src/FloorScene3D.jsx — builds Three.js geometry and materials from the floor data.
- src/MapLabel3D.jsx — renders readable labels in the scene.
- src/LibraryMap3D.jsx — camera controls, chair selection and API-backed availability.
- src/AccountPages.jsx — student sign-in, registration, profile, bookings and check-in lifecycle.
- src/App.jsx — landing page and navigation.
- server/app.js — Express authentication, layout, availability and booking APIs.
- server/migrations/ — versioned PostgreSQL schema changes.
- server/seed.js — adds layout records only when the floor, table and seat tables are empty; optionally inserts a fictional demo student.

## Architecture

PostgreSQL is the source of truth for accounts, floor metadata, tables, seats, bookings and maintenance blocks. Booking creation uses a transaction and a database exclusion constraint to prevent overlaps. MongoDB stores optional append-only activity/audit events; it does not duplicate bookings. MongoDB failure should not prevent student booking operations.

Student registration asks for a USN and an RVCE email. USNs are format-checked and unique, but neither a USN format nor an email domain verifies current enrollment. Students can sign in using either their USN or email plus password. The existing Unity client can continue sending its original email-based login request. No current account has administrator access; the admin allowlist is empty.

Fresh schemas contain no role or approval fields. Migration 003 archives old values in the inert legacy_user_access_archive table, then removes those columns from users without deleting account or booking records.

## Requirements and Windows setup

- Node.js 20.19+ or 22.12+.
- PostgreSQL 15+ with btree_gist available.
- MongoDB Community Server 7+ for optional activity events.

1. Install PostgreSQL and MongoDB Community Server and start their Windows services.
2. Create a SeatSpace database and dedicated login only if they do not already exist. Inspect an existing database and preserve its records; never drop or reset it.
3. Copy .env.example to .env. Set DATABASE_URL, a random JWT_SECRET of at least 32 characters, and optional fictional demo student credentials. Keep .env private; it is ignored by Git.
4. From the project folder, run npm install once. For the USN schema addition on an existing database, use `npm run db:migrate:usn`; it runs only migration 006. The general `npm run db:migrate` command reruns all migration files and must be reviewed before use on an existing database. Run `npm run db:seed` only if the library layout tables are empty.
5. In separate project terminals, run npm run server and npm run dev. Vite forwards /api requests to the backend on port 4000. Or use the Windows scripts below.
6. Open the local Vite URL printed in the terminal. The map opens from overhead; use the view controls for perspective and reset.

### Windows startup shortcuts

- Double-click `start_seatspace.bat` to check Node.js, the local project configuration and the existing PostgreSQL service, then start Express on port 4000 and Vite on port 5181.
- Open `http://127.0.0.1:5181/`; API health is at `http://127.0.0.1:4000/api/health`.
- Double-click `stop_seatspace.bat` to stop only the exact Node processes recorded as started by that script. It leaves services that were already running untouched. It never stops PostgreSQL or MongoDB and does not modify database records.
- For manual startup, use two project-folder terminals and run `npm run server` and `npm run dev -- --host 127.0.0.1 --port 5181`.

MongoDB uses MONGODB_URI and MONGODB_DATABASE from .env. Check /api/health for the API and database states. Existing activity documents are preserved; startup does not replace validators on an existing collection.

## API routes

- POST /api/auth/register, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
- PATCH /api/profile
- GET /api/floors/3/layout
- GET /api/floors/3/availability?startAt=...&endAt=...
- POST /api/bookings, GET /api/bookings/mine
- PATCH /api/bookings/:id/cancel
- POST /api/bookings/:id/check-in
- POST /api/bookings/:id/check-out
- GET /api/health

Sessions use an HTTP-only cookie. Passwords are hashed with bcrypt. Input is validated, SQL is parameterized, and students may only operate on their own bookings. Admin database routes require a backend-only allowlist; it is empty by default.

## Booking lifecycle

- A confirmed reservation is yellow for its selected time range.
- Check-in is available from the booking start through the configurable grace deadline (10 minutes by default).
- A checked-in reservation is red while active. This means the student checked in through SeatSpace; there is no occupancy sensor.
- The backend expires unchecked reservations as no-shows after 10 minutes by default, changes their display to auto-cancelled, and releases the seat. Checked-in bookings are completed after their end time. Historical booking rows remain.
- A student can check out early or cancel an eligible future reservation.

## Current validation

- npm run build creates the production frontend.
- npm run lint checks source code.
- npm test checks third-floor table/seat IDs and counts, scale conversion, garden chair placement, the washroom wall, booking validation and check-in timing.
- Current Vite production build passed and all 12 project tests passed (including the generated Unity layout export). Oxlint exited successfully with warnings for existing unused parameters, render-purity/effect patterns and camera mutability.

## Current project status

The active 3rd-floor visual model has clickable tables and chairs, corrected T14/T20 labels, the washroom wall extension, top-down and perspective views, and API-backed status colors. Selecting a table lists its seat IDs and live states; selecting a chair keeps backend availability separate from its visual selection highlight. The rendered map has not been compared pixel by pixel against the reference after the latest edits; exact matching is not claimed.

The live PostgreSQL 18.6 database was checked read-only on 24 November 2026. It contains 1 floor, 24 tables, 154 seats, 4 users, 15 bookings, 0 maintenance records and 4 legacy access archive rows. Booking history at that snapshot was 7 cancelled, 6 completed and 2 no-show rows; no confirmed bookings were present. Migration 002's check-in columns exist; migration 003's archive table exists and the active user table has no role field; migration 004 is part of the checked-in migration set. No PostgreSQL data was changed during this snapshot. The live catalog has no migration-named ledger table, views, materialized views, user-defined triggers or user-defined public functions; row-level security is disabled. The configured database role is `postgres` and is a superuser, so the backend currently violates least-privilege guidance. Add a separate restricted application login as a reviewed follow-up before deployment.

The live API health endpoint returned `api=ok`, `postgres=ok`, and `mongodb=ok`; `/api/floors/3/layout` returned 24 tables and 154 seats. Unity subsequently refreshed selected seat `T1-S3` to `available` after the backend started. The browser displayed the existing SeatSpace Virtual Library page during this session; its embedded WebGL player and booking interactions were not re-tested. The previous verified browser/API booking and cancellation flow remains recorded in project history; the 15-row database snapshot above includes older history and was not modified here. Concurrent booking tests remain unverified. The server logs safe error types and codes without exposing connection strings.

In the browser follow-up, the home page loaded, the third-floor map finished rendering from the API, and seat `T14-S4` appeared as `Available`. During a hot reload an older 164-seat React state was briefly visible; `LibraryMap3D` now rebuilds seat status from the API's table list rather than the fallback list. The latest observed page accessibility text reported 154 available / 154 total. No reservation was submitted during my browser check.

The existing Windows startup script was run after confirming PostgreSQL was already running. It started the existing backend and Vite processes and wrote its process-ownership manifest. The stop script was not run; no unrelated process was stopped.

Physical Android/iPhone checks, concurrent booking tests, MongoDB event writes/reads, official RVCE SSO, deployment configuration and a pixel-level reference screenshot comparison remain outstanding. AR and indoor positioning are outside this task's scope. Do not treat the project as ready for actual RVCE-wide use until those remaining checks are complete.

## Unity virtual library (in progress)

The Unity 6.3 project is in `UnityVirtualLibrary/`. It reads the same third-floor model used by the React map through the read-only layout export generated by:

```text
npm run unity:export-layout
```

The generated `Assets/StreamingAssets/seatspace-floor3.json` contains 24 tables and 154 existing seat IDs. Unity creates the floor zones, walls, door frames and open leaves, patio rails, bookshelves, book details, tables, individual chairs, plants, reception, the open-sided lounge and ottoman, overhead area labels and lighting at runtime. The starter scene is `Assets/Scenes/SampleScene.unity`; press Play after the Editor imports the project. Controls are WASD to walk, hold the right mouse button to look, and click a chair to select it.

The Unity API client reads the third-floor layout and two-hour seat availability from the existing `/api/floors/3/...` endpoints, refreshes periodically, and submits reservations through the existing `/api/bookings` endpoint. It does not access either database directly. Its in-Editor panel includes SeatSpace sign-in, profile/session loading, My Bookings and eligible future-booking cancellation using the existing cookie-authenticated API. The React `Virtual library` page embeds the existing `public/unity/` WebGL output; do not rebuild it unless necessary and after checking disk space. Unity uses a reflected world-Z coordinate so its directly overhead view follows the approved map orientation.

Unity 6.3 opened the existing bootstrap scene and Play Mode generated 24 tables, 154 seats, 30 walls, 8 doors and 9 shelf rows. The orthographic top-down view displays the existing floor layout. The observed Console had 0 errors and 0 warnings during Play Mode. F8 entered/exited simulated VR and instantiated the XR Origin and XR Device Simulator. F1 hid/restored the SeatSpace HUD. Keyboard input changed the simulated Main Camera local Z position from 0 to 6.8 during the movement check. A desktop click selected `T1-S3`, displayed its ID, and showed `available` after API startup. The current Editor log did not reproduce the old missing Animator warning. Controller pose movement, mouse-held head rotation, controller ray seat selection/trigger, teleport execution, Unity sign-in and Unity booking/cancellation remain unverified. The simulator's interaction instructions are in `docs/unity-simulator-status.md`. No headset was used; the WebGL build was not rebuilt in this continuation.

### Database analysis (in progress)

Migration `005_database_analysis_views.sql` has been applied by itself using `npm run db:migrate:analysis`; it added `seat_availability_current`, `table_availability_current` and populated `seat_usage_daily` without changing booking rows. A read-only catalog/data check confirmed the views exist, and returned 154 available seats plus 10 daily summary rows at the check time. The website now has an admin-only Database Lab for live schema/catalog information, analytics, fixed read-only `EXPLAIN ANALYZE` plans, MongoDB activity history and materialized-view refresh. `ADMIN_EMAILS` is blank by default. Following the owner’s choice, all current accounts remain students and no account can access the admin lab until a separate admin is authorized. See `docs/database-audit.md`. A PostgreSQL audit trigger, RLS/restricted database role, concurrency harness, and authenticated admin UI/API test remain incomplete.
