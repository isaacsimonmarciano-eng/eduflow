// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { internal } from "./_generated/api";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ConvexCredentials({
      id: "ecoledirecte",
      authorize: async (credentials, ctx) => {
        const nonce =
          typeof credentials.nonce === "string" ? credentials.nonce : "";
        if (!nonce) {
          throw new Error(
            "Connexion invalide. Passe par le formulaire de connexion.",
          );
        }

        // The nonce was minted by authEd.prepareSignIn only after a real,
        // successful EcoleDirecte verification. Consume it (one-time use).
        const { edUserId } = (await ctx.runMutation(internal.authEd.consumeNonce, {
          nonce,
        })) as { edUserId: string | null };
        if (!edUserId) {
          throw new Error(
            "Session de connexion expirée. Reprends la connexion depuis le début.",
          );
        }

        const user = (await ctx.runQuery(api.users.byEdUserId, {
          edUserId,
        })) as { _id: unknown } | null;
        if (!user) {
          throw new Error("Compte introuvable. Reconnecte-toi.");
        }
        return { userId: user._id as never };
      },
    }),
  ],
});

import { api } from "./_generated/api";
