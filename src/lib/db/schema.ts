import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
  index,
  vector,
  pgEnum,
} from "drizzle-orm/pg-core";

export const EMBEDDING_DIMENSIONS = 1536;

export const fileKind = pgEnum("file_kind", ["pdf", "pptx", "image", "text"]);
export const fileStatus = pgEnum("file_status", ["processing", "ready", "error"]);
export const questionType = pgEnum("question_type", ["multiple_choice", "open", "true_false"]);

// Users are keyed by their Clerk user id.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color").notNull().default("sage"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("courses_user_idx").on(t.userId)],
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: fileKind("kind").notNull(),
    // Pathname inside the private Blob store; null for pasted text.
    blobPathname: text("blob_pathname"),
    size: integer("size"),
    status: fileStatus("status").notNull().default("processing"),
    error: text("error"),
    pageCount: integer("page_count"),
    chunkCount: integer("chunk_count"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("files_course_idx").on(t.courseId)],
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    // 1-based page (PDF), slide (PPTX), or section (text) number.
    page: integer("page").notNull(),
    position: integer("position").notNull(),
    heading: text("heading"),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  },
  (t) => [
    index("chunks_course_idx").on(t.courseId),
    index("chunks_file_idx").on(t.fileId),
    index("chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    fileIds: jsonb("file_ids").$type<string[]>().notNull().default([]),
    // Percentage 0-100, set when every question has been answered.
    score: real("score"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("quizzes_course_idx").on(t.courseId)],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    type: questionType("type").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>(),
    // For multiple choice: the exact correct option. True/false: "true"/"false". Open: model answer.
    answer: text("answer").notNull(),
    explanation: text("explanation"),
    topic: text("topic").notNull(),
    sourceFileId: uuid("source_file_id").references(() => files.id, { onDelete: "set null" }),
    sourcePage: integer("source_page"),
  },
  (t) => [index("questions_quiz_idx").on(t.quizId), index("questions_course_topic_idx").on(t.courseId, t.topic)],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    response: text("response").notNull(),
    correct: boolean("correct").notNull(),
    // 0-1 partial credit (open questions); 0 or 1 otherwise.
    score: real("score").notNull(),
    feedback: text("feedback"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("attempts_quiz_idx").on(t.quizId), index("attempts_question_idx").on(t.questionId)],
);

export const flashcards = pgTable(
  "flashcards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    sourcePage: integer("source_page"),
    front: text("front").notNull(),
    back: text("back").notNull(),
    topic: text("topic"),
    // SM-2 state
    easeFactor: real("ease_factor").notNull().default(2.5),
    interval: integer("interval").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("flashcards_course_due_idx").on(t.courseId, t.dueAt), index("flashcards_user_due_idx").on(t.userId, t.dueAt)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flashcardId: uuid("flashcard_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // SM-2 quality 0-5
    grade: integer("grade").notNull(),
    intervalAfter: integer("interval_after").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("reviews_card_idx").on(t.flashcardId)],
);

export type Course = typeof courses.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Flashcard = typeof flashcards.$inferSelect;
