import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { mutation } from "./_generated/server";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

/** Look up a user by their stable EcoleDirecte id (auth provider helper). */
export const byEdUserId = query({
  args: { edUserId: v.string() },
  handler: async (ctx, { edUserId }) => {
    return await ctx.db
      .query("users")
      .withIndex("edUserId", (q) => q.eq("edUserId", edUserId))
      .first();
  },
});

/** True if no user exists yet for the given class (auth provider helper). */
export const isFirstInClass = query({
  args: { className: v.string() },
  handler: async (ctx, { className }) => {
    if (!className) return true;
    const existing = await ctx.db
      .query("users")
      .withIndex("by_class", (q) => q.eq("className", className))
      .first();
    return existing === null;
  },
});

/** Create a user from a verified EcoleDirecte profile (auth provider helper). */
export const createFromEd = mutation({
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
      className: args.className,
      classRole: args.classRole,
    });
  },
});

/** Refresh name / class on sign-in (auth provider helper). */
export const syncFromClass = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    className: v.string(),
  },
  handler: async (ctx, { userId, name, className }) => {
    await ctx.db.patch(userId, {
      ...(name ? { name } : {}),
      className,
    });
  },
});

/** Create / attach an email-only user to Isaac's class (delegation invite). */
export const jonFromEmail = mutation({
  args: {
    email: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, { email, displayName }) => {
    const lower = email.trim().toLowerCase();
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", lower))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: displayName || existing.name,
        className: "Isaac Marciano",
        classRole: "eleve",
      });
      return { joined: false as const, userId: existing._id };
    }

    const id = await ctx.db.insert("users", {
      name: displayName || "Élève",
      email: lower,
      className: "Isaac Marciano",
      classRole: "eleve",
    });
    return { joined: true as const, userId: id };
  },
});

/** Class directory: names and roles only, for everyone in the class. */
export const listClassmates = query({
  args: {},
  handler: async (ctx) => {
    const viewerId = await getAuthUserId(ctx);
    if (viewerId === null) return [];
    const viewer = await ctx.db.get(viewerId);
    const className = viewer?.className;
    if (!className) return [];

    const rows = await ctx.db
      .query("users")
      .withIndex("by_class", (q) => q.eq("className", className))
      .collect();

    return rows
      .map((u) => ({
        _id: u._id,
        name: u.name ?? "Élève",
        classRole: u.classRole ?? "eleve",
        isMe: u._id === viewerId,
        // Only via EcoleDirecte — email-only accounts are anonymes pour les
        // camarades (nombres et rôles, pas d'email jamais exposé).
        fromEd: !!(u.edUserId ?? false),
      }))
      .sort((a, b) => {
        // Délégués first, then alphabetical.
        if (a.classRole !== b.classRole) {
          return a.classRole === "delegue" ? -1 : 1;
        }
        return a.name.localeCompare(b.name, "fr");
      });
  },
});
