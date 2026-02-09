# Personal Trainer AI

AI-powered personal training app that generates customized weekly workout plans based on your profile, fitness goals, and workout history. Uses Claude (Anthropic) as the AI brain and Supabase for data storage.

## Setup

### 1. Database (Supabase)

Run `schema.sql` in your Supabase SQL editor to create the tables and seed the exercise library.

### 2. Environment Variables

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_KEY="your-anon-key"
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 3. Install & Run

```bash
cd trainer
npm install
npm start
```

Open http://localhost:3001

## How It Works

1. **Set up your profile** — age, weight, goals, equipment, injuries, notes from your previous trainer
2. **Generate a plan** — the AI creates a multi-day workout plan tailored to you
3. **View your plans** — browse all generated weekly plans with exercises, sets, reps, rest times, and video links
4. **Log your workouts** — record what you actually did and how it felt
5. **Progressive overload** — the AI reads your past logs and adjusts future plans accordingly

## Architecture

```
trainer/
├── server.js          # Express API + Claude AI integration
├── schema.sql         # Supabase database schema + seed data
├── package.json
├── README.md
└── public/
    ├── index.html     # Single-page app
    ├── styles.css     # Dark theme UI
    └── app.js         # Frontend logic
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/profile` | Get current user profile |
| POST | `/api/profile` | Create/update profile |
| GET | `/api/exercises` | List exercise library |
| GET | `/api/plans` | List workout plans |
| GET | `/api/plans/:id` | Get single plan |
| POST | `/api/generate` | Generate new weekly plan (calls Claude AI) |
| GET | `/api/logs` | List workout logs |
| POST | `/api/logs` | Log a completed workout |
