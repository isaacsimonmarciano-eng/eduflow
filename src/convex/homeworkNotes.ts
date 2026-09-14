import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const attachmentValidator = v.object({
  name: v.string(),
  type: v.string(),
  url: v.optional(v.string()),
  storageId: v.optional(v.id("_storage")),
});

type Attachment = {
  name: string;
  type: string;
  url?: string;
  storageId?: string;
};

function cleanAttachments(items: Attachment[]) {
  if (items.length > 8) throw new Error("Maximum 8 pièces jointes par note.");
  return items.map((item) => {
    const name = item.name.trim().slice(0, 180) || "Pièce jointe";
    const type = item.type.trim().slice(0, 120) || "application/octet-stream";
    const url = item.url?.trim().slice(0, 2000);
    if (url && !/^https?:\/\//i.test(url)) throw new Error("Le lien doit commencer par http:// ou https://.");
    if (!url && !item.storageId) throw new Error("Pièce jointe invalide.");
    return { name, type, ...(url ? { url } : {}), ...(item.storageId ? { storageId: item.storageId } : {}) };
  });
}

export const list = query({
  args: { homeworkId: v.id("homework") },
  handler: async (ctx, { homeworkId }) => {
    const uid = await getAuthUserId(ctx);
    if (!uid) return [];
    const me = await ctx.db.get(uid);
    const hw = await ctx.db.get(homeworkId);
    if (!hw || !me?.className || hw.className !== me.className) return [];
    const rows = await ctx.db.query("homeworkNotes").withIndex("by_homework", (q) => q.eq("homeworkId", homeworkId)).collect();
    const out = [];
    for (const note of rows) {
      const author = await ctx.db.get(note.authorId);
      const attachments = await Promise.all((note.attachments ?? []).map(async (item) => ({
        ...item,
        url: item.storageId ? (await ctx.storage.getUrl(item.storageId)) ?? undefined : item.url,
      })));
      out.push({ ...note, attachments, authorName: author?.name ?? "Un élève", mine: note.authorId === uid });
    }
    return out.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const add = mutation({
  args: { homeworkId: v.id("homework"), text: v.string(), attachments: v.optional(v.array(attachmentValidator)) },
  handler: async (ctx, { homeworkId, text, attachments = [] }) => {
    const uid = await getAuthUserId(ctx);
    if (!uid) throw new Error("Connecte-toi d'abord.");
    const me = await ctx.db.get(uid);
    const hw = await ctx.db.get(homeworkId);
    if (!me?.className || !hw || hw.className !== me.className) throw new Error("Devoir introuvable.");
    const clean = text.trim().slice(0, 4000);
    const files = cleanAttachments(attachments as Attachment[]);
    if (!clean && files.length === 0) throw new Error("Ajoute une note, un lien ou un fichier.");
    return ctx.db.insert("homeworkNotes", {
      homeworkId,
      className: me.className,
      authorId: uid,
      text: clean || undefined,
      attachments: files as never,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const edit = mutation({
  args: { id: v.id("homeworkNotes"), text: v.string(), attachments: v.optional(v.array(attachmentValidator)) },
  handler: async (ctx, { id, text, attachments = [] }) => {
    const uid = await getAuthUserId(ctx);
    if (!uid) throw new Error("Connecte-toi d'abord.");
    const note = await ctx.db.get(id);
    if (!note || note.authorId !== uid) throw new Error("Tu ne peux modifier que ta propre note.");
    const me = await ctx.db.get(uid);
    if (!me?.className || note.className !== me.className) throw new Error("Note introuvable.");
    const clean = text.trim().slice(0, 4000);
    const files = cleanAttachments(attachments as Attachment[]);
    if (!clean && files.length === 0) throw new Error("La note ne peut pas être vide.");
    const nextStorage = new Set(files.map((a) => a.storageId).filter(Boolean));
    for (const old of note.attachments ?? []) {
      if (old.storageId && !nextStorage.has(old.storageId)) await ctx.storage.delete(old.storageId);
    }
    await ctx.db.patch(id, { text: clean || undefined, attachments: files as never, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("homeworkNotes") },
  handler: async (ctx, { id }) => {
    const uid = await getAuthUserId(ctx);
    if (!uid) throw new Error("Connecte-toi d'abord.");
    const note = await ctx.db.get(id);
    if (!note) return;
    if (note.authorId !== uid) throw new Error("Tu ne peux supprimer que ta propre note.");
    for (const item of note.attachments ?? []) if (item.storageId) await ctx.storage.delete(item.storageId);
    await ctx.db.delete(id);
  },
});
