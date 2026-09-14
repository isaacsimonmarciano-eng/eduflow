import { v } from "convex/values";
import {
  action,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Email-only sign-in for students who don't have EcoleDirecte credentials.
 *
 * Flow (mirrors EcoleDirecte nonce flow so the same Convex Auth credentials
 * provider can open the session identically):
 *  1. `startEmail` — validate email + display name, insert the user into
 *     Isaac Marciano's class as an `eleve`, mint a nonce.
 *  2. `finishEmail` — notify Isaac (todo: webhook / email to délégué). Right
 *     now the user is usable immediately, flagged as email sign-in.
 *  3. The Convex Auth credentials provider (`src/convex/auth.ts`) already
 *     accepts a nonce from `internal.authEd.consumeNonce` — we reuse that
 *     exact path, binding the nonce to an `edUserId` in the shape
 *     `email:<lowercase email>` (non-numeric by design, never collides with
 *     real EcoleDirecte ids).
 */

const CLASS_NAME = "Isaac Marciano";

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type EmailStartResult =
  | { ok: true; nonce: string; userId: string }
  | { ok: false; message: string };

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
      // Already registered via email — just refresh name/sync and mint a nonce.
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

    // New email-only account — immediate join (no délégué approval required).
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

// ── internal helpers (the provider consumes the same nonce path) ──────────

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
