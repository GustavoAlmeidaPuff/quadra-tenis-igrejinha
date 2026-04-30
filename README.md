# Quadra Livre — Community tennis court booking

**Mobile-first** web app for community tennis court management. Built with Next.js 15, Firebase, and TypeScript. It covers the full flow: authentication, conflict-checked bookings, social profiles, player challenges, and per-court admin.

---

## Features

### Authentication and onboarding
- Google sign-in (Firebase Auth)
- Onboarding for new users to set name and profile data
- Automatic redirects based on auth state

### Personal dashboard
- Personalized greeting with near real-time stats
- Next upcoming reservation
- Smart time suggestion based on user history
- Cards for total hours played, reservation count, and active-week streak
- Bar chart of weekday play frequency
- List of most frequent partners with links to each profile

### Schedule and reservations
- Timeline view (hour-by-hour) for the next 7 days
- Red line for current time on the schedule
- Visual indicators on days that already have bookings
- New reservation modal with date, time, and participant picker
- Fixed duration of 1h30 per reservation
- Court selection from courts available to the user
- Edit participants on an existing reservation
- Cancel reservation (creator only)
- Server-side slot conflict checks (Firebase Admin SDK), including:
  - At most 1 reservation per day per user
  - At most 4 reservations per week
  - Up to 7 days ahead
- Booking confirmation email via Brevo

### User profiles
- Public profile with photo, name, and summary stats
- **Detailed statistics** subpage:
  - Total hours played
  - Weekday frequency (bar chart)
  - Hours per month (bar chart)
  - Hours per week (bar chart)
  - Ranking of top partners with photo and match count
- Subpage with reservation history per court

### Social feed
- Community post feed
- Post likes
- Comments with `@mention` support
- Notification when mentioned in a comment
- Notification when someone likes your post

### Player challenges
- Send a challenge to another player with message and proposed time
- Accept or decline from the notifications page
- On accept, a reservation is created for both players
- Cancel a sent challenge before it is answered
- Challenge notification email via Brevo
- Flow to accept and pick a time for challenges without a fixed slot

### Notifications
- Real-time notification center (Firestore `onSnapshot`)
- Types: challenge received/sent, mention in post, like on post
- Auto-mark as read when opening the page
- Per-notification delete (soft-delete with `hiddenByUserIds`, hard-delete when both sides hide)

### Multi-court management
- Multiple courts with tab selection on the schedule
- Slot conflicts checked per court
- `courtId` normalization for legacy data (`normalizeCourtId`)
- Gear icon on the court tab for managers to open settings from the schedule

### Court manager panel (`/court/[courtId]/manage`)
- Restricted to court managers (`managerIds[]` in Firestore)
- Add and remove other managers
- Layout guard blocking unauthorized access

### Developer panel (`/admin`)
- Restricted to the developer email
- Create default courts in Firestore
- View and manage all courts and their managers
- Layout guard blocking unauthorized access

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | Firebase Auth (Google) |
| Database | Firestore (Firebase) |
| Backend/API | Next.js Route Handlers + Firebase Admin SDK |
| Image upload | Firebase Storage |
| Transactional email | Brevo (formerly Sendinblue) |
| Icons | Lucide React |
| Drag and drop | dnd-kit |
| Dates | date-fns |

---

## Architecture

```
src/
├── app/
│   ├── (auth)/                    # Unauthenticated pages
│   │   ├── login/
│   │   ├── onboarding/
│   │   └── select-court/
│   ├── (app)/                     # Authenticated app (header + nav)
│   │   ├── home/                  # Dashboard
│   │   ├── reserve/               # Schedule and new reservation
│   │   ├── social/                # Post feed
│   │   ├── notifications/       # Notification center
│   │   ├── profile/
│   │   │   └── [userId]/
│   │   │       ├── page.tsx       # Public profile
│   │   │       ├── statistics/    # Charts and metrics
│   │   │       ├── courts/        # History per court
│   │   │       └── level/         # Player rank / level
│   │   ├── court/[courtId]/
│   │   │   └── manage/            # Court manager panel
│   │   ├── lessons/
│   │   ├── cafe/
│   │   └── partners/
│   ├── admin/                     # Developer panel
│   └── api/
│       ├── reservations/          # POST, DELETE, PATCH + check-slot
│       ├── notify-challenge/      # Challenge email
│       └── upload-image/          # Upload to Firebase Storage
├── components/
│   ├── layout/                    # Header, BottomNav, CourtStatus, Avatar
│   └── reservation/               # NewReservationModal, ReservationDetailModal
└── lib/
    ├── firebase/                  # Client SDK and Admin SDK
    ├── queries/                   # Query helpers (stats, etc.)
    ├── validators/                # Business rule validation
    ├── courts.ts                  # Constants and DEVELOPER_EMAIL
    ├── permissions.ts             # isDeveloper, isCourtManager, canManageCourt
    ├── types.ts                   # TypeScript interfaces
    └── utils.ts                   # Utilities
```

### Firestore collections

| Collection | Description |
|---|---|
| `users` | User profile data |
| `reservations` | Reservations (startAt, endAt, courtId, createdById) |
| `reservationParticipants` | Participants per reservation |
| `courts` | Courts with name and manager list (`managerIds[]`) |
| `challenges` | Challenges between players |
| `posts` | Social feed posts |
| `notifications` | Mention and like notifications |

---

## Local setup

### Prerequisites
- Node.js 18+
- Firebase project with Firestore, Auth (Google), and Storage enabled
- Brevo account (for emails)

### Install

```bash
git clone <repo-url>
cd quadra-tenis-igrejinha
npm install
```

### Environment variables

Create `.env.local` in the project root:

```env
# Firebase (client)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin (API routes)
# Local dev: path to service account JSON file
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
# Production (Vercel): JSON content as a single line
# FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Brevo (transactional email)
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=
```

> Generate the Firebase Admin service account key in **Firebase Console → Project settings → Service accounts → Generate new private key**.

### Development

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Deploy (Vercel)

1. Connect the repository to Vercel
2. Add all `NEXT_PUBLIC_*` variables in project settings
3. For Firebase Admin in production, set `FIREBASE_SERVICE_ACCOUNT_KEY` with minified one-line JSON (do not use `FIREBASE_SERVICE_ACCOUNT_PATH` on Vercel)
4. Add Brevo variables
5. Deploy

---

## Firestore security rules (reference)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth.uid == userId;
    }
    match /reservations/{reservationId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.createdById;
    }
    match /reservationParticipants/{participantId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.authorId;
    }
    match /challenges/{challengeId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.toUserId
                    || request.auth.uid == resource.data.fromUserId;
    }
  }
}
```

---

## First-time developer setup

1. Sign in with the email configured as `DEVELOPER_EMAIL` in `src/lib/courts.ts`
2. Open `/admin`
3. Click **“Create default courts”** to seed courts in Firestore
4. Add court managers as needed
