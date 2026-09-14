import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";

const CLASS_NAME = "Isaac Marciano";

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type EmailStartResult =
  | { ok: true; nonce: string; userId: string; message?: never }
  | { ok: false; message: string; nonce?: never; userId?: never };

export const startEmail = action({
  args: {
    email: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, { email, displayName }): Promise<EmailStartResult> => {
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      return { ok: false, message: "Adresse e-mail invalide." };
    }
    if (displayName.trim().length < 1) {
      return { ok: false, message: "Donne au moins un prénom ou un surnom." };
    }

    const existing = (await ctx.runQuery(internal.emailSignIn.byEmail, {
      email: address,
    })) as { _id: unknown } | null;

    const edUserId = `email:${address}`;
    const isFirst = (await ctx.runQuery(internal.emailSignIn.isFirstEmail, {})) as
      | boolean
      | number;

    if (existing) {
      await ctx.runMutation(internal.emailSignIn.syncFromEmail, {
        userId: existing._id as never,
        name: displayName.trim(),
      });
      const nonce = randomToken();
      await ctx.runMutation(internal.authEd.storeNonce, {
        nonce,
        edUserId,
        expiresAt: Date.now() + 2 * 60 * 1000,
      });
      return { ok: true, nonce, userId: existing._id as string };
    }

    const isDelegue = isFirst === true || isFirst === 1;
    const userId = await ctx.runMutation(internal.emailSignIn.createFromEmail, {
      edUserId,
      name: displayName.trim(),
      className: CLASS_NAME,
      classRole: isDelegue ? "delegue" : "eleve",
    });

    const nonce = randomToken();
    await ctx.runMutation(internal.authEd.storeNonce, {
      nonce,
      edUserId,
      expiresAt: Date.now() + 2 * 60 * 1000,
    });

    return { ok: true, nonce, userId };
  },
});

export const byEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
  },
});

export const isFirstEmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_class", (q) => q.eq("className", CLASS_NAME))
      .first();
    return row === null;
  },
});

export const createFromEmail = internalMutation({
  args: {
    edUserId: v.string(),
    name: v.string(),
    className: v.string(),
    classRole: v.union(v.literal("eleve"), v.literal("delegue")),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("users", {
      name: args.name || "Élève",
      edUserId: args.edUserId,
      email: args.edUserId.replace(/^email:/, ""),
      className: args.className,
      classRole: args.classRole,
    });
  },
});

export const syncFromEmail = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, { userId, name }) => {
    await ctx.db.patch(userId, { name: name || "Élève" });
  },
});
