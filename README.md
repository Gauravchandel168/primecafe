# PrimeCafe Web

QR-code-based multi-cafe ordering system built with React (Vite), Tailwind CSS, and Firebase (Firestore, Auth, Realtime Database).

## Features

- **Global splash loader** — runs once per browser session
- **QR menu** — `/menu/{cafeId}?table={tableNumber}` loads cafe-specific menu
- **Customer ordering** — cart, place order, live order status tracking
- **Admin panel** — live orders, bill generation, menu management, QR generator

## Prerequisites

- Node.js 18+
- Firebase project (`restaurant-menu-fb763` or your own)

## Setup

1. **Install dependencies**

   ```bash
   cd primecafe-web
   npm install
   ```

2. **Environment variables**

   Copy `.env.example` to `.env` and fill in your Firebase web config:

   ```bash
   cp .env.example .env
   ```

   Required variables:

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID` (optional)
   - `VITE_FIREBASE_DATABASE_URL` — enable Realtime Database in Firebase Console

3. **Firebase Console setup**

   - Enable **Authentication** → Email/Password
   - Enable **Firestore Database**
   - Enable **Realtime Database**
   - Deploy security rules (see below)

4. **Seed data**

   Create documents in Firestore:

   **Cafe** — `/cafes/{cafeId}`

   ```json
   {
     "name": "Prime Cafe Breakfast",
     "logo": "https://example.com/logo.png",
     "themeColor": "#F59E0B"
   }
   ```

   **Admin** — `/admins/{firebaseAuthUid}`

   ```json
   {
     "cafeId": "your-cafe-id",
     "email": "admin@example.com"
   }
   ```

   Create the admin user in Firebase Authentication with the same email, then link the UID in `/admins/{uid}`.

   **Or use self-signup:** open `/admin/signup` to create an account — this automatically creates the cafe and admin profile.

   **Menu items** — `/cafes/{cafeId}/menu/{itemId}`

   ```json
   {
     "name": "Cappuccino",
     "price": 150,
     "category": "Beverages",
     "image": "https://example.com/cappuccino.jpg",
     "available": true
   }
   ```

5. **Run locally**

   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173)

## Routes

| Route | Description |
|-------|-------------|
| `/` | Splash screen (first visit per session) |
| `/menu/:cafeId?table=N` | Customer menu (QR entry point) |
| `/order-status/:cafeId/:orderId` | Live order tracking |
| `/admin` | Admin dashboard (protected) |
| `/admin/login` | Admin sign in |
| `/admin/signup` | Register a new cafe + admin account |

## Deploy Firebase Rules

From the `primecafe-web` directory (with Firebase CLI installed):

```bash
firebase deploy --only firestore:rules,database
```

Or copy `firestore.rules` and `database.rules.json` into your Firebase project settings.

### Firestore rules summary

- Cafes, menus, orders: **read** open to customers
- Orders: **create** open (customers place orders without auth)
- Menu & order updates: **admin only** (matched via `/admins/{uid}.cafeId`)

### Realtime Database rules summary

- `liveOrders/{cafeId}/{orderId}`: read open; write for live status sync

## Build for production

```bash
npm run build
```

Output is in `dist/`. Deploy to Firebase Hosting, Vercel, or any static host. Configure SPA rewrites so all routes serve `index.html`.

### Firebase Hosting example

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

## Project structure

```
src/
├── main.jsx
├── App.jsx
├── firebase.js
├── pages/          # Splash, Menu, OrderStatus, Admin
├── components/     # Cart, Menu cards, Orders, Bill, QR
└── context/        # Cart & Auth providers
```

## Tech stack

- React 19 + Vite 6
- Tailwind CSS 4
- Firebase 11 (Firestore, Auth, Realtime Database)
- react-router-dom, react-hot-toast, react-icons, qrcode.react

## License

Private — PrimeCafe
# primecafe
