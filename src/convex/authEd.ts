import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  ecoleDirecteStart,
  ecoleDirecteFinish,
} from "./auth/ecoleDirecte";

/**
 * Public EcoleDirecte sign-in flow (3 steps, all verified server-side):
 *  1. `start` — real credential check against EcoleDirecte. Returns either
 *     the student profile, or the secret-question challenge.
 *  2. `finish` — submits the chosen answer to the secret question.
 *  3. `prepareSignIn` — after a successful verification, creates/refreshes
 *     the app user and mints a one-time nonce bound to the EcoleDirecte
 *     user id. The Convex Auth credentials provider consumes that nonce to
 *     open the real session.
 */

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type StartOk = {
  ok: true;
  edUserId: string;
  name: string;
  className: string;
  handle: undefined;
  question: undefined;
  choices: undefined;
};
type StartTwoFa = {
  ok: false;
  twoFa: true;
  message: undefined;
  handle: string;
  question: string;
  choices: { label: string; value: string }[];
};
type StartErr = {
  ok: false;
  twoFa: false;
  message: string;
  handle: undefined;
  question: undefined;
  choices: undefined;
};

export const start = action({
  args: { identifiant: v.string(), motdepasse: v.string() },
  handler: async (ctx, { identifiant, motdepasse }): Promise<StartOk | StartTwoFa | StartErr> => {
    const result = await ecoleDirecteStart(identifiant, motdepasse);

    if (result.ok) {
      return {
        ok: true,
        edUserId: result.profile.edUserId,
        name: `${result.profile.firstName} ${result.profile.lastName}`.trim(),
        className: result.profile.className,
        handle: undefined,
        question: undefined,
        choices: undefined,
      };
    }

    if ("twoFa" in result && result.twoFa) {
      // Store the pending EcoleDirecte session server-side; hand only a
      // random handle to the client (cookies never touch the browser).
      const handle = randomToken();
      await ctx.runMutation(internal.authEd.storePending, {
        handle,
        cookiesJson: result.pending,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return {
        ok: false,
        twoFa: true,
        message: undefined,
        handle,
        question: result.question,
        choices: result.choices,
      };
    }

    return {
      ok: false,
      twoFa: false,
      message: result.message,
      handle: undefined,
      question: undefined,
      choices: undefined,
    };
  },
});

export const finish = action({
  args: {
    identifiant: v.string(),
    motdepasse: v.string(),
    handle: v.string(),
    choixValue: v.string(),
  },
  handler: async (
    ctx,
    { identifiant, motdepasse, handle, choixValue },
  ): Promise<
    | { ok: true; edUserId: string; name: string; className: string }
    | { ok: false; message: string }
    | {
        ok: false;
        message: undefined;
        question: string;
        choices: { label: string; value: string }[];
      }
  > => {
    const pending = await ctx.runQuery(internal.authEd.getPending, { handle });
    if (!pending) {
      return {
        ok: false,
        message:
          "Session de vérification expirée. Reprends la connexion depuis le début.",
      };
    }

    const result = await ecoleDirecteFinish(
      identifiant,
      motdepasse,
      pending.cookiesJson,
      choixValue,
    );

    // EcoleDirecte can chain another question — refresh the stored session
    // state and surface the new question to the user.
    if (!result.ok && "pending" in result && result.pending) {
      await ctx.runMutation(internal.authEd.updatePending, {
        handle,
        cookiesJson: result.pending,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return {
        ok: false,
        message: undefined,
        question: result.question,
        choices: result.choices,
      };
    }

    await ctx.runMutation(internal.authEd.deletePending, { handle });

    if (!result.ok) {
      return { ok: false, message: result.message ?? "Échec de la vérification." };
    }

    return {
      ok: true,
      edUserId: result.profile.edUserId,
      name: `${result.profile.firstName} ${result.profile.lastName}`.trim(),
      className: result.profile.className,
    };
  },
});

/** Mint a one-time nonce bound to a verified EcoleDirecte user id. */
export const prepareSignIn = action({
  args: {
    edUserId: v.string(),
    name: v.string(),
    className: v.string(),
  },
  handler: async (ctx, { edUserId, name, className }) => {
    // Create / refresh the app user now, so the provider only has to find it.
    const isFirst = (await ctx.runQuery(api.users.isFirstInClass, {
      className,
    })) as boolean;
    const existing = (await ctx.runQuery(api.users.byEdUserId, { edUserId })) as
      | { _id: unknown }
      | null;

    if (!existing) {
      await ctx.runMutation(api.users.createFromEd, {
        edUserId,
        name,
        className,
        classRole: isFirst ? "delegue" : "eleve",
      });
    } else {
      await ctx.runMutation(api.users.syncFromClass, {
        userId: existing._id as never,
        name,
        className,
      });
    }

    const nonce = randomToken();
    await ctx.runMutation(internal.authEd.storeNonce, {
      nonce,
      edUserId,
      expiresAt: Date.now() + 2 * 60 * 1000,
    });
    return { nonce };
  },
});

// ── internal helpers ──────────────────────────────────────────

export const storePending = internalMutation({
  args: { handle: v.string(), cookiesJson: v.string(), expiresAt: v.number() },
  handler: async (ctx, { handle, cookiesJson, expiresAt }) => {
    await ctx.db.insert("pendingLogins", { handle, cookiesJson, expiresAt });
  },
});

export const getPending = internalQuery({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const row = await ctx.db
      .query("pendingLogins")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .first();
    if (!row || row.expiresAt < Date.now()) return null;
    return { cookiesJson: row.cookiesJson };
  },
});

export const updatePending = internalMutation({
  args: { handle: v.string(), cookiesJson: v.string(), expiresAt: v.number() },
  handler: async (ctx, { handle, cookiesJson, expiresAt }) => {
    const row = await ctx.db
      .query("pendingLogins")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .first();
    if (!row) return;
    await ctx.db.patch(row._id, { cookiesJson, expiresAt });
  },
});

export const deletePending = internalMutation({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const row = await ctx.db
      .query("pendingLogins")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

export const storeNonce = internalMutation({
  args: { nonce: v.string(), edUserId: v.string(), expiresAt: v.number() },
  handler: async (ctx, { nonce, edUserId, expiresAt }) => {
    await ctx.db.insert("loginNonces", { nonce, edUserId, expiresAt });
  },
});

export const consumeNonce = internalMutation({
  args: { nonce: v.string() },
  handler: async (ctx, { nonce }) => {
    const row = await ctx.db
      .query("loginNonces")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .first();
    if (!row || row.expiresAt < Date.now()) {
      return { edUserId: null as string | null };
    }
    await ctx.db.delete(row._id);
    return { edUserId: row.edUserId };
  },
});
