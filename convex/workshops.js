import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function formatWorkshop(w) {
  if (!w) return w;
  return {
    ...w,
    id: w._id,
    createdAt: w.createdAt || w._creationTime,
    updatedAt: w.updatedAt || w._creationTime,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.db.query("workshops").collect();
    const result = [];
    for (const w of list) {
      let facilitatorName = "Unknown";
      const facId = ctx.db.normalizeId("facilitators", w.facilitatorId);
      if (facId) {
        const fac = await ctx.db.get(facId);
        if (fac) {
          facilitatorName = fac.name;
        }
      }

      const participants = await ctx.db
        .query("participants")
        .withIndex("by_workshopId", (q) => q.eq("workshopId", w._id))
        .collect();

      const feedback = await ctx.db
        .query("feedback")
        .withIndex("by_workshopId", (q) => q.eq("workshopId", w._id))
        .collect();

      const avgRating = feedback.length > 0
        ? parseFloat((feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(2))
        : 0;

      result.push({
        ...w,
        id: w._id,
        createdAt: w.createdAt || w._creationTime,
        updatedAt: w.updatedAt || w._creationTime,
        facilitatorName,
        participantCount: participants.length,
        avgRating,
        feedbackCount: feedback.length,
      });
    }
    return result;
  },
});

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const wId = ctx.db.normalizeId("workshops", args.id);
    if (!wId) return null;
    const w = await ctx.db.get(wId);
    return formatWorkshop(w);
  },
});
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    facilitatorId: v.string(),
    status: v.optional(v.string()), // 'draft' by default
    dateTime: v.optional(v.string()),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("workshops", {
      title: args.title,
      description: args.description,
      facilitatorId: args.facilitatorId,
      status: args.status || "draft",
      dateTime: args.dateTime,
      capacity: args.capacity ?? 20,
      createdAt: now,
      updatedAt: now,
    });
    const inserted = await ctx.db.get(id);

    let facilitatorName = "Unknown";
    const facId = ctx.db.normalizeId("facilitators", args.facilitatorId);
    if (facId) {
      const fac = await ctx.db.get(facId);
      if (fac) {
        facilitatorName = fac.name;
      }
    }

    return {
      ...formatWorkshop(inserted),
      facilitatorName,
    };
  },
});

export const update = mutation({
  args: {
    id: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    facilitatorId: v.optional(v.string()),
    status: v.optional(v.string()),
    dateTime: v.optional(v.string()),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const wId = ctx.db.normalizeId("workshops", args.id);
    if (!wId) {
      throw new Error("Invalid workshop ID");
    }

    const current = await ctx.db.get(wId);
    if (!current) {
      throw new Error("Workshop not found");
    }

    const patchObj = {
      updatedAt: Date.now(),
    };
    if (args.title !== undefined) patchObj.title = args.title;
    if (args.description !== undefined) patchObj.description = args.description;
    if (args.facilitatorId !== undefined) patchObj.facilitatorId = args.facilitatorId;
    if (args.status !== undefined) {
      const allowedStatus = ["draft", "published", "registration_closed", "completed", "archived"];
      if (!allowedStatus.includes(args.status)) {
        throw new Error(`Invalid status: ${args.status}`);
      }
      patchObj.status = args.status;
    }
    if (args.dateTime !== undefined) patchObj.dateTime = args.dateTime;
    if (args.capacity !== undefined) patchObj.capacity = args.capacity;

    await ctx.db.patch(wId, patchObj);
    const updated = await ctx.db.get(wId);

    let facilitatorName = "Unknown";
    const facId = ctx.db.normalizeId("facilitators", updated.facilitatorId);
    if (facId) {
      const fac = await ctx.db.get(facId);
      if (fac) {
        facilitatorName = fac.name;
      }
    }

    return {
      ...formatWorkshop(updated),
      facilitatorName,
    };
  },
});
