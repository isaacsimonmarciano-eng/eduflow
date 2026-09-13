import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // EcoleDirecte identity (sign-in via the unofficial login API).
      edUserId: v.optional(v.string()), // stable EcoleDirecte student id
      className: v.optional(v.string()), // e.g. "3ème B"
      classRole: v.optional(
        v.union(v.literal("eleve"), v.literal("delegue")),
      ),
    })
      .index("email", ["email"]) // index for the email. do not remove or modify
      .index("edUserId", ["edUserId"])
      .index("by_class", ["className"]),

    // Course summaries, one per course session (v1 of the app).
    lessons: defineTable({
      subjectKey: v.string(), // key from src/lib/subjects.ts
      date: v.string(), // course date, "YYYY-MM-DD"
      title: v.string(),
      summary: v.string(),
      keyPoints: v.array(v.string()),
      notes: v.optional(v.string()), // raw dictaphone notes
      status: v.union(v.literal("draft"), v.literal("published")),
      className: v.optional(v.string()), // class this summary belongs to
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_subject_date", ["subjectKey", "date"])
      .index("by_status", ["status"]),

    // Homework entries, one per assignment (due date + subject).
    homework: defineTable({
      subjectKey: v.string(), // key from src/lib/subjects.ts
      dueDate: v.string(), // due date, "YYYY-MM-DD"
      text: v.string(),
      emoji: v.string(),
      className: v.optional(v.string()), // class this homework belongs to
      doneBy: v.array(v.id("users")),
      createdBy: v.id("users"),
      createdAt: v.number(),
    }).index("by_due_date", ["dueDate"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
