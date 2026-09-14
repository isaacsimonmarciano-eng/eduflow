import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connecte-toi d'abord.");
    const user = await ctx.db.get(userId);
    if (!user?.className) throw new Error("Tu dois appartenir à une classe.");
    return ctx.storage.generateUploadUrl();
  },
});
