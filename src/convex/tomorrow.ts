import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const me = await ctx.db.get(userId);
    if (!me?.className) return null;

    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const slots = await ctx.db
      .query("timetableSlots")
      .withIndex("by_class_date", (q) => q.eq("className", me.className!).eq("date", tomorrow))
      .collect();

    const subjectKeys = [...new Set(slots.map((slot) => slot.subjectKey))];
    const lessons = await ctx.db.query("lessons").collect();
    const recentBySubject: Record<string, typeof lessons> = {};

    for (const subjectKey of subjectKeys) {
      recentBySubject[subjectKey] = lessons
        .filter(
          (lesson) =>
            lesson.className === me.className &&
            lesson.status === "published" &&
            lesson.subjectKey === subjectKey &&
            lesson.date <= tomorrow,
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt)
        .slice(0, 3);
    }

    return {
      date: tomorrow,
      slots: slots.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      recentBySubject,
    };
  },
});
