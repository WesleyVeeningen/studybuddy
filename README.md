# StudyBuddy

Upload course material and study it with a patient AI tutor: grounded chat with citations, quizzes with
feedback and weak-topic tracking, and SM-2 flashcards. English and Dutch.

## Stack

- Next.js 16 (App Router, Cache Components), Tailwind v4, shadcn/ui
- AI SDK 7 via Vercel AI Gateway — tutor: `anthropic/claude-sonnet-5.5`, embeddings: `cohere/embed-v4.0`
- Neon Postgres + pgvector, Drizzle ORM
- Vercel Blob (private) for uploads, Clerk for auth (email + Google)

## Local development

```bash
vercel link            # once
vercel env pull        # writes .env.local (DB, Blob, Clerk, OIDC token for AI Gateway)
npm install
npm run db:migrate
npm run dev
```

Set `TUTOR_MODEL` to override the tutor model (e.g. `google/gemini-2.5-flash` while the AI Gateway
account is on the free tier, which doesn't include Claude).

## How it works

- **Upload** — files go straight from the browser to private Blob (`/api/upload`), then
  `registerUpload` stores a row and processes it in `after()`: PDF text via `unpdf` (scanned PDFs and
  photos are transcribed by the model), PPTX slide + speaker-note text via JSZip, then ~1200-char
  chunks are embedded into `chunks.embedding` (HNSW cosine index).
- **Chat** — `/api/chat` retrieves the top chunks for the question (plus recent turns for follow-ups)
  and streams an answer that cites `[n]`; the source list rides along as message metadata.
- **Quiz** — `generateQuiz` samples material (or searches by focus topic) and asks for typed
  questions tagged with a broad topic. MC/true-false are graded exactly; open answers are graded by
  the model with feedback. Topic accuracy (last 10 attempts) drives "Topics to review".
- **Flashcards** — generated from material, scheduled with SM-2 (`src/lib/sm2.ts`). "Due today" uses
  the student's own timezone (cookie set by the browser).
