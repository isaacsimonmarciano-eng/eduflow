// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { ecoleDirecteLogin } from "./auth/ecoleDirecte";
import { api } from "./_generated/api";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ConvexCredentials({
      id: "ecoledirecte",
      authorize: async (credentials, ctx) => {
        const identifiant =
          typeof credentials.identifiant === "string"
            ? credentials.identifiant.trim()
            : "";
        const motdepasse =
          typeof credentials.motdepasse === "string"
            ? credentials.motdepasse
            : "";
        if (!identifiant || !motdepasse) {
          throw new Error("Entre ton identifiant et ton mot de passe EcoleDirecte.");
        }

        // Real verification against EcoleDirecte (unofficial API).
        const result = await ecoleDirecteLogin(identifiant, motdepasse);
        if (!result.ok) {
          throw new Error(result.message);
        }

        // Find or create the app user keyed by the stable EcoleDirecte id.
        const existing = await ctx.runQuery(api.users.byEdUserId, {
          edUserId: result.profile.edUserId,
        });
        if (existing) {
          // Keep name / class info fresh on each sign-in.
          const name = fullName(result.profile);
          if (existing.className !== result.profile.className || existing.name !== name) {
            await ctx.runMutation(api.users.syncFromClass, {
              userId: existing._id,
              className: result.profile.className,
              name,
            });
          }
          return { userId: existing._id };
        }

        // First sign-in for this student: create the account.
        const isFirstOfClass = await ctx.runQuery(api.users.isFirstInClass, {
          className: result.profile.className,
        });
        const userId = await ctx.runMutation(api.users.createFromEd, {
          edUserId: result.profile.edUserId,
          name: fullName(result.profile),
          className: result.profile.className,
          classRole: isFirstOfClass ? "delegue" : "eleve",
        });
        return { userId };
      },
    }),
  ],
});

function fullName(profile: { firstName: string; lastName: string }): string {
  return `${profile.firstName} ${profile.lastName}`.trim();
}
