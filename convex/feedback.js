import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function formatFeedback(f) {
  if (!f) return f;
  return {
    ...f,
    id: f._id,
    createdAt: f.createdAt || f._creationTime,
  };
}

export const list = query({
  args: { workshopId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let list;
    if (args.workshopId) {
      list = await ctx.db
        .query("feedback")
        .withIndex("by_workshopId", (q) => q.eq("workshopId", args.workshopId))
        .collect();
    } else {
      list = await ctx.db.query("feedback").collect();
    }
    return list.map(formatFeedback);
  },
});

export const create = mutation({
  args: {
    workshopId: v.string(),
    participantId: v.string(),
    rating: v.number(),
    comments: v.optional(v.string()),
    mcqResponses: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5.");
    }

    // Verify workshop and participant exist (optional check, but good practice)
    const wId = ctx.db.normalizeId("workshops", args.workshopId);
    if (!wId) throw new Error("Invalid workshop ID");
    const workshop = await ctx.db.get(wId);
    if (!workshop) throw new Error("Workshop not found");

    const pId = ctx.db.normalizeId("participants", args.participantId);
    if (!pId) throw new Error("Invalid participant ID");
    const participant = await ctx.db.get(pId);
    if (!participant) throw new Error("Participant not found");

    const id = await ctx.db.insert("feedback", {
      workshopId: args.workshopId,
      participantId: args.participantId,
      rating: args.rating,
      comments: args.comments,
      mcqResponses: args.mcqResponses || null,
      createdAt: Date.now(),
    });

    const inserted = await ctx.db.get(id);
    return formatFeedback(inserted);
  },
});
