import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

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
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
      return { ok: false, message: "Adresse e-mail invalide." };
    }
    const name = displayName.trim();
    if (name.length < 1) {
      return { ok: false, message: "Donne au moins un prénom ou un surnom." };
    }

    const edUserId = `email:${address}`;

    const existing = (await ctx.runQuery(api.users.byEdUserId, {
      edUserId,
    })) as { _id: string } | null;

    const isFirst = (await ctx.runQuery(api.users.isFirstInClass, {
      className: CLASS_NAME,
    })) as boolean;

    let userId: string;
    if (existing) {
      await ctx.runMutation(api.users.syncFromClass, {
        userId: existing._id as never,
        name,
        className: CLASS_NAME,
      });
      // keep email in sync if we patched name only — patch email via internal helper
      await ctx.runMutation(internal.users.patchEmailForEdUser, {
        userId: existing._id as never,
        email: address,
      });
      // if there was a pending invite, mark accepted
      await ctx.runMutation(api.invites.acceptForEmail, { email: address });
      userId = existing._id as string;
    } else {
      const newId = (await ctx.runMutation(api.users.createFromEd, {
        edUserId,
        name,
        className: CLASS_NAME,
        classRole: isFirst ? "delegue" : "eleve",
        email: address,
      })) as string;
      await ctx.runMutation(api.invites.acceptForEmail, { email: address });
      userId = newId;
    }

    const nonce = randomToken();
    await ctx.runMutation(internal.authEd.storeNonce, {
      nonce,
      edUserId,
      expiresAt: Date.now() + 2 * 60 * 1000,
    });

    return { ok: true, nonce, userId };
  },
});
