# MASTER DEVELOPMENT PROMPT
## Local On-Premise Biometric Attendance & Executive Dashboard System

You are a senior software architect, Python/FastAPI engineer, React engineer, PostgreSQL engineer, DevOps engineer, and ZKTeco integration specialist.

Your task is to BUILD a production-ready, fully local, on-premise Biometric Attendance Management System and Executive Dashboard for an organization using ZKTeco biometric attendance terminals over a LAN.

The system must work with ZERO EXTERNAL INTERNET DEPENDENCY during normal operation.

Do not create a conceptual demo or mock-only dashboard. Build a functioning application with a real backend, real database, real ZKTeco device integration, automatic synchronization, executive analytics, personnel management, reports, auditing, and local deployment.

---

# 1. PROJECT OBJECTIVE

Build a centralized local attendance system that:

1. Connects directly to ZKTeco biometric terminals over LAN using the ZKTeco protocol.
2. Automatically extracts attendance logs from devices without USB export.
3. Stores biometric punch transactions in a local relational database.
4. Prevents duplicate records through idempotent ingestion.
5. Applies configurable punch debounce rules.
6. Maintains personnel/master data separately from raw biometric logs.
7. Calculates daily attendance states such as:
   - Present
   - Late
   - Absent
   - Approved Leave
   - OSD
   - Medical
   - Duty Rest
   - Weekend / Holiday
8. Provides an executive-level real-time dashboard.
9. Provides rank-wise and department-wise operational analytics.
10. Provides a dedicated full-screen live gate/reception screen.
11. Provides daily muster roll and date-range reports.
12. Exports reports to Excel and CSV.
13. Maintains device connectivity and ingestion audit logs.
14. Automatically retries when devices are unavailable.
15. Automatically starts after server reboot.
16. Runs entirely within the organization's LAN.
17. Must remain operational when the internet is unavailable.

---

# 2. IMPORTANT ENGINEERING RULES

Follow these rules throughout the project:

- Do NOT use cloud services.
- Do NOT require Firebase, Supabase, Auth0, AWS, Azure, Vercel, or any external SaaS.
- Do NOT require external APIs during runtime.
- Do NOT use mock biometric data once device integration is implemented.
- Keep the system modular and production-oriented.
- Use environment variables for configurable settings.
- Use database migrations.
- Use structured application logging.
- Use proper error handling.
- Never silently swallow exceptions.
- Never hard-code device IP addresses in application logic.
- Never hard-code credentials.
- All configurable values must be environment-driven or stored in admin settings.
- Use timezone-aware timestamps.
- Default timezone: Asia/Karachi.
- Design the database so multiple ZKTeco devices can be added later.
- Design APIs cleanly using REST.
- Use WebSockets for live updates where appropriate.
- Use background workers/tasks for synchronization.
- Keep raw biometric transactions immutable.
- Store derived attendance status separately from raw punch records.
- Make synchronization idempotent.
- Make the system recover automatically after process crashes.
- Avoid overengineering beyond the 4-day deployment target.

---

# 3. REQUIRED TECHNOLOGY STACK

## Backend

Use:

- Python 3.12+
- FastAPI
- SQLAlchemy 2.x
- Pydantic v2
- Alembic
- pyzk or a compatible ZKTeco protocol implementation
- PostgreSQL as primary database
- SQLite fallback for development/small installations if necessary
- Uvicorn
- WebSockets
- Pandas / OpenPyXL for report generation

## Frontend

Use:

- React
- Vite
- TypeScript
- Tailwind CSS
- Recharts
- React Router
- Axios or fetch
- TanStack Query if useful

## Deployment

Use:

- Linux server
- systemd for production process management

PM2 may be used for frontend static/server process only if needed, but systemd is preferred.

Use:

- Nginx
- PostgreSQL
- local LAN IP

The main application must be accessible through a browser on the LAN.

Example:

http://192.168.1.100:4000

or:

http://attendance.local

if local DNS is available.

---

# 4. HIGH LEVEL ARCHITECTURE

Implement this architecture:

ZKTeco Device
        |
        | TCP/IP / Port 4370
        |
        v
ZKTeco Integration Layer
        |
        v
Ingestion / Sync Service
        |
        +------> Raw Attendance Punches
        |
        +------> Attendance Processing Engine
        |
        v
PostgreSQL
        |
        +------> FastAPI REST API
        |
        +------> WebSocket Events
        |
        v
React Executive Dashboard

Separate logical modules:

backend/
    app/
        main.py
        config.py
        database.py
        models/
        schemas/
        repositories/
        services/
        api/
        core/
        zk/
        attendance/
        reports/
        websocket/
        workers/
        utils/
    migrations/
    tests/

frontend/
    src/
        components/
        pages/
        layouts/
        hooks/
        services/
        types/
        charts/
        utils/
        router/
        main.tsx

infra/
    systemd/
    nginx/
    scripts/

docs/

---

# 5. DATABASE DESIGN

Create a normalized relational database.

Minimum tables:

## devices

Fields:

- id
- name
- ip_address
- port
- communication_password
- enabled
- location
- last_seen_at
- last_sync_at
- connection_status
- created_at
- updated_at

Port default: 4370.

---

## personnel

Fields:

- id
- biometric_user_id
- employee_code
- full_name
- rank
- designation
- department
- category
- duty_type
- shift_id
- sanctioned_status
- employment_status
- photo_path
- created_at
- updated_at

category must support:

- Uniform
- Non-Uniform

employment_status should support:

- Active
- Inactive
- Suspended
- Retired

Add a UNIQUE constraint for biometric_user_id.

---

## departments

Fields:

- id
- name
- code
- active
- created_at

---

## ranks

Fields:

- id
- name
- code
- sort_order
- active

---

## shifts

Fields:

- id
- name
- start_time
- end_time
- late_grace_minutes
- early_leave_minutes
- active

---

## attendance_punches

This table stores RAW device logs.

Fields:

- id
- device_id
- biometric_user_id
- punch_time
- punch_type
- verified
- raw_status
- raw_work_code
- source
- created_at

Important:

Raw punches must NEVER be modified after successful ingestion.

Create an idempotency mechanism.

Recommended unique key:

(device_id, biometric_user_id, punch_time)

If the specific device protocol produces another reliable unique identifier, use that as an additional identity key.

---

## attendance_daily

Derived daily attendance state.

Fields:

- id
- personnel_id
- attendance_date
- first_in
- last_out
- total_work_minutes
- status
- late_minutes
- overtime_minutes
- source
- calculated_at

Status values:

- PRESENT
- LATE
- ABSENT
- LEAVE
- OSD
- MEDICAL
- DUTY_REST
- WEEKEND
- HOLIDAY
- OFF_DAY

Unique:

(personnel_id, attendance_date)

---

## exceptions

Fields:

- id
- personnel_id
- date
- exception_type
- reason
- approved_by
- remarks
- created_at
- updated_at

exception_type:

- LEAVE
- OSD
- MEDICAL
- DUTY_REST

---

## holidays

Fields:

- id
- holiday_date
- name
- description

---

## device_sync_logs

Fields:

- id
- device_id
- started_at
- completed_at
- status
- logs_found
- logs_inserted
- logs_skipped
- error_message

---

## audit_logs

Fields:

- id
- action
- entity_type
- entity_id
- old_value
- new_value
- performed_by
- created_at

---

## system_settings

Fields:

- id
- key
- value
- value_type
- description

Store settings such as:

- sync_interval_seconds
- debounce_seconds
- timezone
- default_shift
- late_grace_minutes
- dashboard_refresh_interval

---

# 6. ZKTECO DEVICE INTEGRATION

Implement a dedicated ZKTeco integration service.

Create:

backend/app/zk/

Suggested files:

zk_client.py
device_manager.py
sync_service.py
exceptions.py

The system should support:

CONNECT
↓
DISABLE DEVICE
↓
READ ATTENDANCE
↓
ENABLE DEVICE
↓
PROCESS / VERIFY
↓
STORE
↓
DISCONNECT

Use transient connections.

Do NOT hold the socket open permanently unless the device/library specifically requires it.

---

# 7. DEVICE CONNECTION LIFECYCLE

Every sync operation should approximately follow:

1. Load enabled devices.
2. Open socket.
3. Connect.
4. Authenticate if password is configured.
5. Disable device operations if needed.
6. Read attendance records.
7. Re-enable device.
8. Disconnect.
9. Process fetched logs.
10. Deduplicate.
11. Persist only new records.
12. Update device heartbeat metadata.
13. Write sync audit log.

Ensure cleanup using try/finally.

Even on exceptions:

- Re-enable device where applicable.
- Disconnect socket.
- Log exception.
- Update device connection status.

---

# 8. AUTOMATIC SYNC DAEMON

Implement background synchronization.

Default:

SYNC_INTERVAL = 30 seconds or configurable.

The daemon must:

- Run continuously.
- Process all enabled devices.
- Retry failed devices.
- Never crash the whole application because one device is unreachable.
- Log all synchronization attempts.
- Store last successful sync timestamp.
- Update device online/offline status.

Use asynchronous/background scheduling where appropriate.

Avoid blocking the FastAPI request thread.

Possible design:

DeviceSyncScheduler
    |
    +-- Device A sync
    +-- Device B sync
    +-- Device C sync

Each device should fail independently.

---

# 9. IDEMPOTENT INGESTION

Critical requirement.

The same attendance log may be returned repeatedly by ZKTeco.

Never create duplicate records.

Implement:

- database UNIQUE constraint
- application-level deduplication
- transaction-safe insertion

Example identity:

device_id + biometric_user_id + punch_time

When a duplicate is encountered:

do not throw a fatal error.

Count it as:

logs_skipped += 1

and continue.

---

# 10. ANTI-BOUNCE / DOUBLE-PUNCH FILTER

Implement configurable debounce.

Default:

60 seconds.

Example:

Employee punches at:

08:00:01
08:00:20

Second punch may be treated as duplicate/noise if within configured debounce interval.

However:

DO NOT delete raw device records.

Store raw data intact.

Apply debounce during attendance interpretation.

Configurable:

DEBOUNCE_SECONDS=60

---

# 11. ATTENDANCE PROCESSING ENGINE

Create dedicated attendance logic.

Example:

08:30 shift start
Grace period = 10 minutes

Employee first punch:

08:36

Status:

PRESENT

Employee first punch:

08:48

Status:

LATE

The exact thresholds must be configurable.

Attendance calculation priority:

1. Holiday
2. Weekend / off day
3. Approved exception
4. Attendance punches
5. Absent

For example:

If employee has approved LEAVE for a date:

status = LEAVE

even if no punch exists.

If employee is absent and approved OSD:

status = OSD

etc.

---

# 12. DAILY ATTENDANCE ALGORITHM

For every active employee and attendance date:

1. Determine whether date is weekend.
2. Determine whether date is holiday.
3. Determine approved exception.
4. Fetch employee shift.
5. Fetch punches.
6. Apply debounce logic for interpretation.
7. Identify first IN.
8. Identify final OUT.
9. Calculate work duration.
10. Calculate late minutes.
11. Calculate overtime where appropriate.
12. Assign final status.

The system must be able to generate a daily attendance snapshot.

---

# 13. ON-SITE MOVEMENT

Implement movement tracking.

For a simple initial implementation:

- First valid punch = IN
- Next valid punch = OUT
- Alternate IN / OUT

or use the device punch state when reliable.

Maintain:

- current presence state
- current in/out status
- last punch time

Dashboard should display:

INSIDE
OUTSIDE
UNKNOWN

For each employee where data allows.

---

# 14. EXECUTIVE DASHBOARD

Create a premium executive dashboard.

The design should be:

- modern
- clean
- professional
- enterprise
- responsive
- data-dense but readable
- suitable for management display

Do NOT create a generic template-looking dashboard.

Prefer:

- dark/light professional theme
- clear typography
- strong visual hierarchy
- subtle animations
- cards
- charts
- tables
- status badges

---

# 15. DASHBOARD TOP KPI CARDS

Create cards for:

TOTAL STRENGTH
PRESENT
ATTENDANCE %
LATE
ABSENT
LEAVE
OSD
MEDICAL
DUTY REST

Each card should support:

- current count
- percentage where useful
- trend/secondary metadata where available

Example:

PRESENT
1,238
92.4%

---

# 16. WORKFORCE RATIO

Display:

Uniform
Non-Uniform

Use donut chart or radial chart.

Example:

Uniform: 72%
Non-Uniform: 28%

---

# 17. ATTENDANCE DISTRIBUTION CHART

Create interactive chart showing:

Present
Late
Absent
Leave
OSD
Medical
Duty Rest
Weekend

Allow filtering by:

- today
- date
- department

---

# 18. STRENGTH BY RANK

Create horizontal bar chart.

Example:

Officer          48
Inspector       112
Assistant        96
Technician      210
Staff            390

Sort by configured rank order where possible.

---

# 19. DEPARTMENT SUMMARY

Create department cards/table showing:

Department
Strength
Present
Absent
Late
Leave
OSD

Use filters.

---

# 20. RANK-WISE OPERATIONAL MATRIX

Create an executive table:

| Rank | Total | Present | Late | Absent | Leave | OSD | Medical | Duty Rest |
|------|------:|--------:|-----:|-------:|------:|----:|--------:|----------:|

Requirements:

- sortable
- searchable
- responsive
- exportable
- sticky header
- pagination when necessary

---

# 21. LIVE PUNCH FEED

Show a real-time feed:

Employee Name
Rank
Department
Punch Time
Direction
Status

Example:

Ahmed Khan
Inspector
Operations
08:42:13
IN
Present

Use WebSockets to update without full page reload.

When a new valid punch is ingested:

broadcast an event.

Example event:

attendance.punch.created

---

# 22. LIVE SCREEN / KIOSK MODE

Create dedicated route:

/live-screen

Purpose:

Reception / gate monitoring.

Requirements:

- full-screen optimized
- large typography
- auto-updating
- no sidebar
- no unnecessary controls
- high visibility
- dark professional visual mode
- current clock
- latest employee punch
- employee name
- rank
- department
- timestamp
- IN/OUT status

When a successful punch occurs, briefly highlight the event.

---

# 23. PERSONNEL MANAGEMENT

Create CRUD screens.

Features:

- list employees
- add employee
- edit employee
- disable employee
- search
- filter by department
- filter by rank
- filter by category
- assign shift
- assign biometric_user_id

Do not allow accidental duplicate biometric_user_id.

---

# 24. MASTER DATA

Create screens for:

Departments
Ranks
Shifts
Holidays
Attendance Exceptions
Devices
System Settings

---

# 25. EXCEPTION MANAGEMENT

Admin must be able to create:

LEAVE
OSD
MEDICAL
DUTY REST

For an employee/date.

Fields:

employee
date
type
reason
remarks
approver

When an exception is saved:

recalculate daily attendance for that date.

---

# 26. DEVICE MANAGEMENT

Create admin page:

Device Name
IP
Port
Location
Password
Enabled
Status
Last Seen
Last Sync
Last Error

Buttons:

Test Connection
Sync Now
Enable
Disable

Test Connection should perform a real connectivity check.

Sync Now should trigger actual synchronization.

---

# 27. SYSTEM HEALTH

Create a system health section.

Show:

Backend status
Database status
Device status
Last successful sync
Sync latency
Current server time
Application uptime

---

# 28. REPORTING

Create report module.

Required reports:

1. Daily Muster Roll
2. Attendance Summary
3. Employee Attendance
4. Department Attendance
5. Rank-wise Attendance
6. Exception Report
7. Device Sync Report

Filters:

- start date
- end date
- department
- rank
- employee
- status

---

# 29. EXPORT

Support:

CSV
Excel (.xlsx)

Use OpenPyXL for Excel.

Export should preserve:

- headers
- formatting
- readable widths
- filters where appropriate
- totals

File names should be meaningful.

Example:

attendance_report_2026-09-12.xlsx

---

# 30. REST API

Create organized routers.

Example:

/api/v1/auth
/api/v1/dashboard
/api/v1/personnel
/api/v1/departments
/api/v1/ranks
/api/v1/shifts
/api/v1/devices
/api/v1/attendance
/api/v1/exceptions
/api/v1/reports
/api/v1/settings
/api/v1/health

Use:

- request validation
- pagination
- filtering
- sorting
- consistent error responses

---

# 31. WEBSOCKET EVENTS

Implement WebSocket endpoint such as:

/ws/dashboard

Events:

attendance.punch.created
attendance.updated
device.status.updated
dashboard.metrics.updated

Frontend must subscribe and refresh relevant components without unnecessary full-page reloads.

---

# 32. AUTHENTICATION

The application is local, but admin access must still be protected.

Implement simple local authentication.

Minimum:

Admin login
Session/JWT authentication
Password hashing with bcrypt/argon2

Roles:

ADMIN
SUPERVISOR
VIEWER

Permissions:

ADMIN:
full access

SUPERVISOR:
attendance/personnel/reports

VIEWER:
dashboard/live screen/reports read-only

Do not store plaintext passwords.

---

# 33. SECURITY

Implement:

- password hashing
- JWT or secure local session
- CORS restricted to local frontend origin
- input validation
- SQL injection protection via SQLAlchemy
- protected admin routes
- audit logging
- no secrets in source code
- .env support
- safe error messages

Since this is an on-premise solution, security must still be treated as production-grade.

---

# 34. CONFIGURATION

Create:

.env.example

Example:

APP_NAME=Local Attendance System

HOST=0.0.0.0
PORT=4000

DATABASE_URL=postgresql+psycopg://attendance_user:password@localhost:5432/attendance_db

TIMEZONE=Asia/Karachi

SYNC_INTERVAL_SECONDS=30
DEBOUNCE_SECONDS=60

JWT_SECRET=CHANGE_ME

DEFAULT_SHIFT_START=08:30
DEFAULT_LATE_GRACE_MINUTES=10

FRONTEND_URL=http://localhost:5173

Do not commit actual secrets.

---

# 35. FRONTEND ROUTES

Create at minimum:

/login
/dashboard
/live-screen
/attendance
/personnel
/departments
/ranks
/shifts
/exceptions
/devices
/reports
/settings
/system-health

---

# 36. FRONTEND LAYOUT

Main application shell:

Sidebar
Top Header
Main Content
Notifications

Sidebar sections:

Dashboard
Live Screen
Attendance
Personnel
Master Data
Devices
Reports
System Health
Settings

Hide administrative options according to role.

---

# 37. DASHBOARD FILTER BAR

Dashboard should support:

Date
Department
Rank
Category
Shift

Default date:

Today

Filters should update all major widgets.

---

# 38. UI STATES

Every data-driven component must support:

Loading
Empty
Success
Error

Do not show broken/blank components.

Example:

Loading:
skeleton

Error:
friendly retry state

Empty:
"No attendance records found."

---

# 39. RESPONSIVENESS

Support:

Desktop
Laptop
Large display
Tablet

Primary target:

1366x768
1920x1080

Dashboard must look good on large screens.

---

# 40. API RESPONSE DESIGN

Use predictable response structures.

Example:

{
  "success": true,
  "data": {...},
  "message": null
}

For lists:

{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total": 500
  }
}

Errors:

{
  "success": false,
  "message": "Device connection failed",
  "code": "DEVICE_CONNECTION_ERROR"
}

---

# 41. LOGGING

Use structured logging.

Log:

- application startup
- application shutdown
- device connection
- device disconnection
- sync start
- sync completion
- logs fetched
- new records
- duplicate records
- processing failures
- authentication failures
- report generation errors

Never log passwords or secrets.

---

# 42. ERROR HANDLING

Device problems must NOT kill the entire application.

Examples:

Device offline:
mark device OFFLINE and continue.

Database error:
log critical error and surface health issue.

Malformed biometric record:
skip safely, log warning.

One invalid employee mapping:
do not discard all logs.

---

# 43. MULTI-DEVICE DESIGN

Although the first installation may contain one ZKTeco device, architecture must support multiple devices.

Example:

Gate 1
Gate 2
Office
Warehouse

All devices synchronize into one centralized database.

Do not duplicate employee data per device.

---

# 44. DATA RETENTION

Do not automatically delete raw attendance punches.

Provide configurable retention policy for logs in the future, but default behavior is to keep all raw transactions.

---

# 45. DATABASE INDEXING

Add appropriate indexes.

At minimum:

attendance_punches:
(device_id, biometric_user_id, punch_time)

attendance_daily:
(personnel_id, attendance_date)

personnel:
biometric_user_id
department_id
rank_id

exceptions:
personnel_id, date

device_sync_logs:
device_id, started_at

---

# 46. TRANSACTION SAFETY

When ingesting attendance records:

Use database transactions.

Do not partially corrupt batches.

Preferred flow:

fetch
→ validate
→ deduplicate
→ insert
→ commit
→ recalculate affected attendance dates
→ publish events

---

# 47. TESTING REQUIREMENTS

Create tests for:

1. Device connection handling
2. Duplicate attendance ingestion
3. Debounce calculation
4. First IN / final OUT
5. Late calculation
6. Absent calculation
7. Leave override
8. OSD override
9. Medical override
10. Duty Rest override
11. Weekend logic
12. Holiday logic
13. Department aggregation
14. Rank aggregation
15. Dashboard KPIs
16. API permissions
17. Excel export
18. Device failure recovery

Use pytest.

---

# 48. SEED DATA

Provide development seed script.

Seed:

- sample departments
- sample ranks
- sample shifts
- sample users
- admin user
- example holidays

For development only.

Clearly distinguish SEED DATA from actual biometric device records.

---

# 49. NO FAKE PRODUCTION DATA

Do not present generated/sample records as real attendance.

Mock data may only be enabled through explicit development mode.

Production mode must use actual database records.

---

# 50. HEALTH CHECKS

Backend:

GET /api/v1/health

Return:

application
database
scheduler
devices

Example:

{
  "application": "healthy",
  "database": "healthy",
  "scheduler": "running",
  "devices": {
      "total": 2,
      "online": 2,
      "offline": 0
  }
}

---

# 51. DOCKER SUPPORT

Provide optional Docker setup for development and deployment.

Create:

docker-compose.yml

Services:

backend
frontend
postgres

However, the production deployment must also support standard local installation without Docker.

---

# 52. NGINX

Provide Nginx configuration.

Desired architecture:

Browser
   |
   v
Nginx :80
   |
   +--> frontend
   |
   +--> /api --> FastAPI :8000
   |
   +--> /ws  --> FastAPI WebSocket

The ZKTeco devices communicate directly with the backend host on LAN port 4370.

---

# 53. SYSTEMD

Create service files:

attendance-backend.service
attendance-sync.service

Both should:

- restart automatically
- start on boot
- run under dedicated service user where possible
- log to journald

---

# 54. INSTALLATION SCRIPT

Create:

scripts/install.sh

The script should:

1. install/check dependencies
2. create environment
3. install backend packages
4. install frontend packages
5. initialize database
6. run migrations
7. optionally seed admin
8. build frontend
9. configure services
10. start application

Also create:

scripts/start-dev.sh
scripts/stop.sh
scripts/status.sh

---

# 55. FIRST-RUN EXPERIENCE

After deployment:

1. Open local dashboard.
2. Login as admin.
3. Configure device IP.
4. Test device connection.
5. Add/import personnel.
6. Configure shifts.
7. Configure departments/ranks.
8. Start sync.
9. Confirm attendance logs appear.
10. Dashboard updates automatically.

---

# 56. DEVICE IMPORT / PERSONNEL MAPPING

Implement functionality to read users from ZKTeco where supported.

The admin should be able to:

- fetch device users
- view biometric user IDs
- map to personnel records

Example:

Biometric ID: 1024
Name on Device: Muhammad Ali

Map to:

Employee: EMP-00452
Full Name: Muhammad Ali
Rank: Inspector
Department: Operations

Do not blindly overwrite master personnel records from device data.

---

# 57. ATTENDANCE IMPORT STRATEGY

If device/library supports incremental attendance reads:

prefer incremental synchronization.

If only full logs are available:

read full logs and rely on database idempotency.

Do not assume that deleting device logs is required.

NEVER delete attendance records from device automatically unless explicitly implemented as a separate admin operation.

---

# 58. TIMEZONE

All application attendance calculations must use:

Asia/Karachi

Store timestamps consistently.

Do not use naive datetime objects for important attendance calculations.

---

# 59. BUSINESS DAY LOGIC

The system should support:

Monday-Sunday calendar configuration.

Do not assume Saturday/Sunday are always off-days.

Make weekends configurable through settings.

---

# 60. DASHBOARD KPI DEFINITIONS

Implement clear formulas.

Total Strength:

number of active personnel or configured sanctioned strength, depending on selected dashboard mode.

Present:

employees with valid attendance for selected date.

Attendance %:

Present / Applicable Workforce * 100

Late:

employees whose first valid punch exceeds shift start + grace period.

Absent:

employees with no qualifying attendance and no approved exception/holiday/weekend status.

Leave:

approved leave records.

OSD:

approved OSD records.

Medical:

approved medical records.

Duty Rest:

approved duty rest records.

Weekend:

employees whose attendance date is configured as off-day.

Avoid ambiguous overlapping KPI counts.

---

# 61. REPORT DEFINITIONS

Daily Muster Roll should include:

Sr No
Employee Code
Biometric ID
Name
Rank
Department
Category
Shift
First In
Last Out
Late Minutes
Status

---

# 62. AUDITABILITY

An admin action such as:

"Approved OSD for Employee 105 on 2026-09-12"

must be auditable.

Record:

who
what
when
before
after

---

# 63. PERFORMANCE TARGET

Target:

- dashboard initial load under 2 seconds on LAN under normal data volumes
- API responses under 500ms for common dashboard queries
- live punch visible within a few seconds after ingestion
- sync operation should not block dashboard APIs
- database queries must use indexes

Do not create N+1 query patterns.

Use aggregation queries efficiently.

---

# 64. CODE QUALITY

Requirements:

- clean architecture
- modular services
- type hints
- docstrings where useful
- meaningful naming
- no giant 2000-line files unless unavoidable
- avoid duplicated logic
- no unnecessary abstraction
- reusable components
- clear separation between:
  - API
  - business logic
  - database
  - device protocol
  - frontend UI

---

# 65. DOCUMENTATION

Create:

README.md

Include:

1. Project overview
2. Architecture
3. Requirements
4. Installation
5. Environment variables
6. Database setup
7. ZKTeco configuration
8. Device networking
9. Running backend
10. Running frontend
11. Production deployment
12. systemd
13. Nginx
14. Troubleshooting
15. Backup
16. Recovery
17. User roles
18. Report generation
19. Adding another biometric device

Also create:

docs/
    architecture.md
    database.md
    zkteco-integration.md
    deployment.md
    troubleshooting.md

---

# 66. ZKTECO-SPECIFIC TROUBLESHOOTING DOCUMENTATION

Document:

- port 4370 connectivity
- ping test
- telnet/netcat test
- device communication password
- device static IP
- subnet mismatch
- firewall
- device reboot recovery
- pyzk compatibility
- timeout configuration

Example Linux connectivity check:

ping 192.168.1.201

nc -vz 192.168.1.201 4370

Do not assume ping being disabled means device is unavailable.

---

# 67. BACKUP

Create backup script:

scripts/backup_database.sh

For PostgreSQL:

pg_dump

Create restore documentation.

Backups must remain local unless administrator explicitly copies them elsewhere.

---

# 68. UI/UX QUALITY BAR

The application should feel like an internal enterprise product.

Avoid:

- excessive gradients
- childish animations
- giant empty spaces
- template-looking components
- meaningless decorative widgets

Prefer:

- useful information density
- readable spacing
- professional cards
- crisp charts
- strong table design
- clear status colors
- accessible contrast
- fast interactions

---

# 69. DEVELOPMENT PRIORITY

This project must be completed in a 4-day rapid deployment sprint.

DO NOT spend the first day building every advanced feature.

Use this priority:

DAY 1:
Infrastructure + Database + Backend + ZKTeco connectivity + ingestion

DAY 2:
Attendance processing + personnel + exceptions + APIs

DAY 3:
Executive dashboard + charts + live screen + WebSockets

DAY 4:
Reports + Excel/CSV + authentication + deployment + testing + polish

---

# 70. 4-DAY IMPLEMENTATION PLAN

## DAY 1

Deliver:

- repository structure
- backend
- PostgreSQL
- migrations
- device model
- personnel model
- raw attendance model
- ZKTeco client
- device connection test
- sync daemon
- duplicate prevention
- logging
- health endpoint

At the end of Day 1:

Actual attendance logs should be entering the local database from a real device.

---

## DAY 2

Deliver:

- attendance_daily
- shift engine
- late detection
- absent detection
- leave/OSD/medical/duty-rest
- personnel CRUD
- department/rank/shift CRUD
- exception CRUD
- attendance APIs
- device management APIs

At the end of Day 2:

A real attendance day should be calculable from the device logs.

---

## DAY 3

Deliver:

- React dashboard
- KPI cards
- attendance charts
- workforce ratio
- rank chart
- department analytics
- operational matrix
- live feed
- WebSocket updates
- kiosk live screen

At the end of Day 3:

Management should be able to open the dashboard and see live operational information.

---

## DAY 4

Deliver:

- Excel exports
- CSV exports
- authentication
- audit logs
- health monitoring
- Nginx
- systemd
- backup
- deployment scripts
- testing
- UI polish
- documentation

At the end of Day 4:

System should be deployable on the organization's LAN.

---

# 71. PROJECT EXECUTION STRATEGY FOR CURSOR

IMPORTANT:

Do NOT attempt to generate the entire project blindly in one file or one response.

Work incrementally.

First:

1. Inspect the existing repository.
2. Determine whether project files already exist.
3. Do not overwrite existing functionality without understanding it.
4. Produce a concise implementation plan.
5. Create the required folder structure.
6. Implement backend foundations.
7. Run tests/lint/type checks.
8. Continue module by module.

After each major module:

- verify imports
- verify database migrations
- run tests
- fix errors
- continue

Do not move to frontend until backend foundations are functional.

---

# 72. CURSOR AGENT BEHAVIOR

When implementing:

- Make actual code changes.
- Do not merely explain what should be done.
- Do not return pseudocode when production code is required.
- Prefer complete working files.
- When modifying files, preserve existing good code.
- Do not silently remove functionality.
- Tell me which files were created or modified.
- Tell me how to run/verify the new functionality.
- Run available tests/builds where possible.
- Fix build/runtime issues you encounter.

Do not ask for unnecessary confirmation.

Make sensible engineering decisions when a detail is unspecified.

---

# 73. MOCK MODE

Create a development-only mock device adapter:

MockZKDevice

This should simulate:

- connection
- users
- attendance logs
- device online/offline

But:

PRODUCTION MUST USE THE REAL ZKTeco adapter.

Use dependency injection so:

ZKTecoDeviceAdapter
and
MockZKDeviceAdapter

share the same interface.

---

# 74. DEVICE ABSTRACTION

Create something like:

BaseAttendanceDevice

Methods:

connect()
disconnect()
test_connection()
get_users()
get_attendance()
get_device_info()
enable()
disable()

ZKTeco implementation should implement this interface.

This will make future device integrations easier.

---

# 75. IMPORTANT ZKTECO COMPATIBILITY

Because ZKTeco models and firmware can differ:

- isolate pyzk-specific code in one integration layer
- do not spread pyzk calls through business logic
- handle unavailable methods gracefully
- expose capability checks where necessary
- use configuration for timeout
- log the exact device/model where possible

Do not assume every ZKTeco device exposes identical features.

---

# 76. DEVICE CONFIGURATION UI

Admin should be able to configure:

Name
IP
Port
Password
Location
Enabled

And click:

TEST CONNECTION

The UI should display:

Connected
Device Model
Firmware if available
User Count
Attendance Log Count if available
Last Sync

---

# 77. REAL-TIME EVENT FLOW

When a new punch arrives:

ZKTeco
→ sync daemon
→ raw punch inserted
→ attendance calculation
→ dashboard metric refresh
→ WebSocket broadcast
→ frontend live feed update

Do not rely solely on manual page refresh.

---

# 78. FRONTEND DATA FETCHING

Centralize API requests.

Create:

src/services/api.ts

Create query hooks such as:

useDashboardStats()
useAttendance()
usePersonnel()
useDevices()

Use caching/refetching intelligently.

Do not write duplicated fetch logic in every component.

---

# 79. ERROR UX

For device errors:

"Device Offline"

For API errors:

"Unable to load attendance data"

For sync failures:

"Last synchronization failed at 08:42"

Always show useful status without exposing stack traces to normal users.

---

# 80. FINAL ACCEPTANCE CRITERIA

The project is considered complete only when:

[ ] ZKTeco device connects over LAN
[ ] Port 4370 works
[ ] Real logs are fetched
[ ] Logs are stored locally
[ ] Duplicate logs are not inserted
[ ] Device failures recover automatically
[ ] Personnel can be mapped to biometric IDs
[ ] Attendance status is calculated
[ ] Late detection works
[ ] Leave/OSD/Medical/Duty Rest work
[ ] Dashboard KPI cards work
[ ] Rank charts work
[ ] Department analytics work
[ ] Operational matrix works
[ ] Live punches appear
[ ] Live screen works
[ ] WebSocket updates work
[ ] Reports work
[ ] Excel export works
[ ] CSV export works
[ ] Admin authentication works
[ ] Audit logs work
[ ] Health monitoring works
[ ] Database backup works
[ ] Nginx deployment works
[ ] systemd auto-start works
[ ] Internet is NOT required for runtime
[ ] Full system works through LAN browser
[ ] README/documentation is complete

---

# 81. FINAL DELIVERABLE STRUCTURE

Aim for approximately:

attendance-system/
│
├── backend/
├── frontend/
├── migrations/
├── scripts/
├── infra/
│   ├── nginx/
│   └── systemd/
├── docs/
├── tests/
├── .env.example
├── docker-compose.yml
├── README.md
└── .gitignore

---

# 82. START NOW

Start by inspecting the repository.

Then:

1. Determine current project state.
2. Produce the implementation plan.
3. Create/update the backend architecture.
4. Set up PostgreSQL integration.
5. Create Alembic migrations.
6. Implement device abstraction.
7. Implement ZKTeco adapter.
8. Implement device test connection.
9. Implement ingestion daemon.
10. Implement idempotent punch storage.
11. Add health checks.
12. Run tests.
13. Fix all issues.
14. Then continue toward attendance processing and frontend.

Do not stop at documentation.

The goal is a REAL, RUNNABLE, LOCAL, PRODUCTION-ORIENTED APPLICATION.

The final system must operate without internet access once dependencies and application packages have been installed on the local server.