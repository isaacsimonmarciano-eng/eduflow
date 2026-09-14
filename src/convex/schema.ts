import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

export const ROLES = { ADMIN: "admin", USER: "user", MEMBER: "member" } as const;
export const roleValidator = v.union(v.literal(ROLES.ADMIN), v.literal(ROLES.USER), v.literal(ROLES.MEMBER));
export type Role = Infer<typeof roleValidator>;

const attachmentValidator = v.object({
  name: v.string(),
  url: v.string(),
  type: v.string(),
});

const schema = defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()), image: v.optional(v.string()), email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()), isAnonymous: v.optional(v.boolean()), role: v.optional(roleValidator),
    edUserId: v.optional(v.string()), className: v.optional(v.string()),
    classRole: v.optional(v.union(v.literal("eleve"), v.literal("delegue"))),
    hwSyncedAt: v.optional(v.number()), timetableSyncedAt: v.optional(v.number()),
  }).index("email", ["email"]).index("edUserId", ["edUserId"]).index("by_class", ["className"]),

  lessons: defineTable({
    subjectKey: v.string(), date: v.string(), title: v.string(), summary: v.string(), keyPoints: v.array(v.string()),
    notes: v.optional(v.string()), status: v.union(v.literal("draft"), v.literal("published")),
    className: v.optional(v.string()), createdBy: v.id("users"), createdAt: v.number(), updatedAt: v.number(),
    attachments: v.optional(v.array(attachmentValidator)),
  }).index("by_subject_date", ["subjectKey", "date"]).index("by_status", ["status"]),

  homework: defineTable({
    subjectKey: v.string(), dueDate: v.string(), text: v.string(), emoji: v.string(), className: v.optional(v.string()),
    doneBy: v.array(v.id("users")), createdBy: v.id("users"), createdAt: v.number(),
    source: v.optional(v.union(v.literal("ecoledirecte"), v.literal("manuel"))), sourceId: v.optional(v.string()),
    subjectLabel: v.optional(v.string()), teacher: v.optional(v.string()), isTest: v.optional(v.boolean()),
    importance: v.optional(v.union(v.literal("normal"), v.literal("a_rendre"), v.literal("note"), v.literal("interro"), v.literal("controle"), v.literal("oral"))),
    edDone: v.optional(v.boolean()), syncedAt: v.optional(v.number()),
  }).index("by_due_date", ["dueDate"]).index("by_class_source", ["className", "sourceId"]),

  homeworkNotes: defineTable({
    homeworkId: v.id("homework"), className: v.string(), authorId: v.id("users"), text: v.optional(v.string()),
    attachments: v.optional(v.array(attachmentValidator)), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_homework", ["homeworkId"]).index("by_class", ["className"]),

  questions: defineTable({
    className: v.string(), subjectKey: v.string(), subjectLabel: v.string(), title: v.string(), body: v.string(),
    attachments: v.optional(v.array(attachmentValidator)), authorId: v.id("users"), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_class", ["className"]).index("by_class_subject", ["className", "subjectKey"]),

  questionAnswers: defineTable({
    questionId: v.id("questions"), className: v.string(), authorId: v.id("users"), body: v.string(),
    attachments: v.optional(v.array(attachmentValidator)), helpful: v.optional(v.boolean()), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_question", ["questionId"]),

  invites: defineTable({
    email: v.string(), className: v.string(), invitedBy: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked")),
    createdAt: v.number(), acceptedAt: v.optional(v.number()), acceptedBy: v.optional(v.id("users")),
  }).index("by_email", ["email"]).index("by_class", ["className"]),

  timetableSlots: defineTable({
    className: v.string(), date: v.string(), startTime: v.string(), endTime: v.string(), subjectKey: v.string(),
    subjectLabel: v.string(), teacher: v.optional(v.string()), room: v.optional(v.string()),
  }).index("by_class_date", ["className", "date"]).index("by_class", ["className"]),

  edSessions: defineTable({ edUserId: v.string(), studentId: v.string(), className: v.optional(v.string()), sessionJson: v.string(), updatedAt: v.number() })
    .index("by_ed_user", ["edUserId"]),
  loginNonces: defineTable({ nonce: v.string(), edUserId: v.string(), expiresAt: v.number() }).index("by_nonce", ["nonce"]),
  pendingLogins: defineTable({ handle: v.string(), cookiesJson: v.string(), xGtk: v.optional(v.string()), expiresAt: v.number() }).index("by_handle", ["handle"]),
}, { schemaValidation: false });

export default schema;
