# Studio — Artist Portfolio

A full-stack artist portfolio with Node.js/Express API, SQLite database, and Cloudinary image hosting.

---

## Project Structure

```
studio/
├── server/
│   ├── index.js              ← Express entry point
│   ├── db/
│   │   ├── database.js       ← SQLite setup & migrations
│   │   └── seed.js           ← Sample data seeder
│   ├── middleware/
│   │   ├── auth.js           ← JWT auth
│   │   └── cloudinary.js     ← Cloudinary + multer upload
│   └── routes/
│       ├── works.js          ← Works CRUD API
│       ├── auth.js           ← Login endpoint
│       ├── settings.js       ← Site settings API
│       └── enquiries.js      ← Contact form storage
├── client/
│   ├── index.html            ← Gallery home
│   ├── work.html             ← Work detail
│   ├── about.html            ← About page
│   ├── contact.html          ← Contact form
│   ├── css/style.css         ← All styles
│   ├── js/
│   │   ├── api.js            ← API client (shared)
│   │   ├── gallery.js        ← Gallery rendering
│   │   └── work.js           ← Work detail rendering
│   └── admin/
│       ├── login.html        ← Admin login
│       ├── index.html        ← Works list
│       ├── upload.html       ← Add new work
│       ├── edit.html         ← Edit existing work
│       ├── enquiries.html    ← View contact enquiries
│       └── settings.html     ← Site settings
├── .env.example              ← Environment variable template
├── package.json
└── README.md
```

---

## Local Development Setup

### 1. Install dependencies

```bash
cd studio
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values (see Cloudinary setup below):

```
PORT=3000
NODE_ENV=development
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
ADMIN_PASSWORD=choose_a_strong_password
JWT_SECRET=a_long_random_string_at_least_32_chars
DB_PATH=./studio.db
```

### 3. Seed the database with sample works

```bash
npm run db:seed
```

### 4. Start the development server

```bash
npm run dev
```

The server starts at **http://localhost:3000**

- Public site: http://localhost:3000
- Admin panel: http://localhost:3000/admin/login.html
- API health: http://localhost:3000/api/health

---

## Cloudinary Setup (Free Tier)

Cloudinary stores and serves your artwork images. The free tier gives you 25GB storage and 25GB bandwidth/month — more than enough for a portfolio.

1. Sign up at https://cloudinary.com (free, no credit card needed)
2. Go to your **Dashboard**
3. Copy your **Cloud name**, **API Key**, and **API Secret**
4. Paste them into your `.env` file

Images are automatically optimised (format, quality, size) when served using the Cloudinary URL transforms built into `api.js`.

---

## Admin Panel

Visit `/admin/login.html` and sign in with your `ADMIN_PASSWORD`.

From the admin you can:
- **Add works** — upload images directly to Cloudinary, add all metadata
- **Edit works** — update any field or replace the image
- **Delete works** — removes from database and deletes image from Cloudinary
- **View enquiries** — see contact form submissions, mark as read, reply by email
- **Settings** — update artist name, tagline, bio, contact details (reflected live on the public site)

---

## API Reference

All admin endpoints require `Authorization: Bearer <token>` header.

### Works
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/works` | No | List all works (optional `?category=sculpture`) |
| GET | `/api/works/:id` | No | Get single work |
| POST | `/api/works` | Yes | Create work (multipart/form-data with optional `image`) |
| PATCH | `/api/works/:id` | Yes | Update work metadata |
| PUT | `/api/works/:id/image` | Yes | Replace work image |
| DELETE | `/api/works/:id` | Yes | Delete work + Cloudinary image |
| PATCH | `/api/works/batch/reorder` | Yes | Update sort order |

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | `{ password }` → `{ token }` |
| GET | `/api/auth/check` | Verify token is valid |

### Settings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/settings` | No | Get all site settings |
| PATCH | `/api/settings` | Yes | Update settings |

### Enquiries
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/enquiries` | No | Submit contact form |
| GET | `/api/enquiries` | Yes | List all enquiries |
| PATCH | `/api/enquiries/:id/read` | Yes | Mark as read |
| DELETE | `/api/enquiries/:id` | Yes | Delete enquiry |

---

## Deployment

### Backend → Railway

1. Fork this project.
2. Go to https://railway.app → **New Project → Deploy from GitHub repo**
3. Select your repo
4. In **Variables**, add all your `.env` values:
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `ADMIN_PASSWORD`, `JWT_SECRET`
   - `NODE_ENV=production`
   - `SERVE_STATIC=true` (serves the client/ folder from Express)
   - `DB_PATH=/data/studio.db` (use Railway's persistent volume — see below)
5. In Railway, add a **Volume** mounted at `/data` to persist the SQLite database across deploys
6. Railway auto-detects Node.js and runs `npm start`

Your site will be live at `https://your-project.up.railway.app`

#### Persistent database on Railway
Without a volume, the SQLite file resets on every deploy. In Railway:
- Go to your service → **Volumes** → **Add Volume**
- Mount path: `/data`
- Set `DB_PATH=/data/studio.db` in your environment variables

### Frontend → Vercel (optional split deploy)

If you prefer the frontend on Vercel's CDN for faster global delivery:

1. Copy the `client/` folder into a separate repo (or use a monorepo)
2. Deploy to https://vercel.com
3. In `client/js/api.js`, update the API_BASE to your Railway URL:
   ```js
   return 'https://your-project.up.railway.app/api';
   ```
4. On Railway, set `FRONTEND_URL=https://your-vercel-app.vercel.app` for CORS

For simplicity, the single-server approach (`SERVE_STATIC=true`) works great and requires no CORS configuration.

---

## Changing the Admin Password

Update `ADMIN_PASSWORD` in your `.env` (or Railway environment variables) and restart the server. All existing tokens will remain valid until they expire (7 days).

To invalidate all tokens immediately, also change `JWT_SECRET`.
