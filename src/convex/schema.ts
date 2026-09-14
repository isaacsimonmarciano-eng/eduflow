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
      hwSyncedAt: v.optional(v.number()), // last EcoleDirecte homework sync
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

      // Where the entry comes from: synced from EcoleDirecte's cahier de textes
      // or added by hand for the teachers who don't post there.
      source: v.optional(
        v.union(v.literal("ecoledirecte"), v.literal("manuel")),
      ),
      sourceId: v.optional(v.string()), // stable EcoleDirecte key, for de-duplication
      subjectLabel: v.optional(v.string()), // as spelled by EcoleDirecte
      teacher: v.optional(v.string()),
      isTest: v.optional(v.boolean()), // interrogation / contrôle
      edDone: v.optional(v.boolean()), // already ticked as done on EcoleDirecte
      syncedAt: v.optional(v.number()),
    })
      .index("by_due_date", ["dueDate"])
      .index("by_class_source", ["className", "sourceId"]),

    // EcoleDirecte sessions of signed-in students. Kept server-side (never
    // exposed to the client) so homework can be re-synced without asking for
    // the password again. Refreshed on every sign-in.
    edSessions: defineTable({
      edUserId: v.string(),
      studentId: v.string(),
      className: v.optional(v.string()),
      sessionJson: v.string(), // cookies + GTK + token snapshot
      updatedAt: v.number(),
    }).index("by_ed_user", ["edUserId"]),

    // One-time login nonces: our EcoleDirecte verification actions create a
    // nonce after a successful verification, and the Convex Auth credentials
    // provider consumes it to open the session. Short-lived, single use.
    loginNonces: defineTable({
      nonce: v.string(),
      edUserId: v.string(), // EcoleDirecte user id the nonce is bound to
      expiresAt: v.number(),
    }).index("by_nonce", ["nonce"]),

    // Pending double-auth session state (EcoleDirecte cookies between the
    // question being shown and the answer being submitted). Short-lived.
    pendingLogins: defineTable({
      handle: v.string(), // random handle handed to the client
      cookiesJson: v.string(),
      xGtk: v.optional(v.string()),
      expiresAt: v.number(),
    }).index("by_handle", ["handle"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
