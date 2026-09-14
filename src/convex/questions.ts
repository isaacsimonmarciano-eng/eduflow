import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

async function viewer(ctx: any) {
  const id = await getAuthUserId(ctx);
  if (!id) throw new Error("Connecte-toi d'abord.");
  const user = await ctx.db.get(id);
  if (!user?.className) throw new Error("Tu dois appartenir à une classe.");
  return { id, user, className: user.className as string };
}

export const list = query({ args: {}, handler: async (ctx) => {
  const id = await getAuthUserId(ctx); if (!id) return [];
  const me = await ctx.db.get(id); if (!me?.className) return [];
  const rows = await ctx.db.query("questions").withIndex("by_class", q => q.eq("className", me.className!)).collect();
  const out = [];
  for (const q of rows.sort((a,b) => b.createdAt-a.createdAt)) {
    const author = await ctx.db.get(q.authorId);
    const answers = await ctx.db.query("questionAnswers").withIndex("by_question", x => x.eq("questionId", q._id)).collect();
    out.push({ ...q, authorName: author?.name ?? "Un élève", mine: q.authorId === id, answerCount: answers.length, answered: answers.length > 0 });
  }
  return out;
}});

export const add = mutation({ args: { subjectKey:v.string(), subjectLabel:v.string(), title:v.string(), body:v.string() }, handler: async(ctx,args) => {
  const me=await viewer(ctx); const title=args.title.trim().slice(0,140); const body=args.body.trim().slice(0,4000);
  if(!title && !body) throw new Error("Écris ta question.");
  return ctx.db.insert("questions",{className:me.className,subjectKey:args.subjectKey,subjectLabel:args.subjectLabel,title:title||body.slice(0,80),body,authorId:me.id,createdAt:Date.now(),updatedAt:Date.now()});
}});

export const remove = mutation({ args:{id:v.id("questions")}, handler:async(ctx,{id})=>{ const me=await viewer(ctx); const q=await ctx.db.get(id); if(!q)return; if(q.authorId!==me.id)throw new Error("Tu ne peux supprimer que ta propre question."); const answers=await ctx.db.query("questionAnswers").withIndex("by_question",x=>x.eq("questionId",id)).collect(); for(const a of answers)await ctx.db.delete(a._id); await ctx.db.delete(id); }});

export const answers = query({ args:{questionId:v.id("questions")}, handler:async(ctx,{questionId})=>{ const id=await getAuthUserId(ctx); if(!id)return[]; const me=await ctx.db.get(id); const q=await ctx.db.get(questionId); if(!q||q.className!==me?.className)return[]; const rows=await ctx.db.query("questionAnswers").withIndex("by_question",x=>x.eq("questionId",questionId)).collect(); const out=[]; for(const a of rows){const author=await ctx.db.get(a.authorId);out.push({...a,authorName:author?.name??"Un élève",mine:a.authorId===id});} return out.sort((a,b)=>a.createdAt-b.createdAt); }});

export const answer = mutation({ args:{questionId:v.id("questions"),body:v.string()}, handler:async(ctx,{questionId,body})=>{ const me=await viewer(ctx); const q=await ctx.db.get(questionId); if(!q||q.className!==me.className)throw new Error("Question introuvable."); const text=body.trim().slice(0,4000);if(!text)throw new Error("Écris une réponse.");return ctx.db.insert("questionAnswers",{questionId,className:me.className,authorId:me.id,body:text,createdAt:Date.now(),updatedAt:Date.now()}); }});

export const removeAnswer = mutation({args:{id:v.id("questionAnswers")},handler:async(ctx,{id})=>{const me=await viewer(ctx);const a=await ctx.db.get(id);if(!a)return;if(a.authorId!==me.id)throw new Error("Tu ne peux supprimer que ta propre réponse.");await ctx.db.delete(id);}});
