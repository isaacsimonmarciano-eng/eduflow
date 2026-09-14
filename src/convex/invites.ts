import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

async function assertDelegue(ctx: any, className: string | undefined) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Connecte-toi d'abord.");
  const me = await ctx.db.get(userId);
  if (!me || me.classRole !== "delegue") {
    throw new Error("Seul le délégué peut inviter.");
  }
  if (!className || me.className !== className) {
    throw new Error("Classe invalide.");
  }
  return { userId, me };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const me = await ctx.db.get(userId);
    if (!me?.className) return [];
    const rows = await ctx.db
      .query("invites")
      .withIndex("by_class", (q) => q.eq("className", me.className!))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const inviteByEmail = mutation({
  args: { email: v.string(), className: v.string() },
  handler: async (ctx, { email, className }) => {
    const { userId } = await assertDelegue(ctx, className);
    const normalized = normalizeEmail(email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
      throw new Error("E-mail invalide.");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();
    if (existing && existing.className === className) {
      throw new Error("Cette personne est déjà dans la classe.");
    }
    const prev = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (prev && prev.status === "pending") {
      await ctx.db.patch(prev._id, { createdAt: Date.now() });
      return prev._id;
    }
    return ctx.db.insert("invites", {
      email: normalized,
      className,
      invitedBy: userId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const acceptForEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const userId = await getAuthUserId(ctx);
    const normalized = normalizeEmail(email);
    const inv = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (!inv || inv.status !== "pending") return null;
    await ctx.db.patch(inv._id, {
      status: "accepted",
      acceptedAt: Date.now(),
      acceptedBy: userId ?? undefined,
    });
    return inv._id;
  },
});

export const revoke = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, { inviteId }) => {
    const invite = await ctx.db.get(inviteId);
    if (!invite) throw new Error("Invitation introuvable.");
    await assertDelegue(ctx, invite.className);
    await ctx.db.patch(inviteId, { status: "revoked" });
  },
});
