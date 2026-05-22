import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function formatParticipant(p) {
  if (!p) return p;
  return {
    ...p,
    id: p._id,
    createdAt: p.createdAt || p._creationTime,
  };
}

export const list = query({
  args: { workshopId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let list;
    if (args.workshopId) {
      list = await ctx.db
        .query("participants")
        .withIndex("by_workshopId", (q) => q.eq("workshopId", args.workshopId))
        .collect();
    } else {
      list = await ctx.db.query("participants").collect();
    }
    return list.map(formatParticipant);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    workshopId: v.string(),
    status: v.optional(v.string()), // 'registered' by default
    onboardingStatus: v.optional(v.string()), // 'pending' by default
  },
  handler: async (ctx, args) => {
    // Check if workshop exists
    const wId = ctx.db.normalizeId("workshops", args.workshopId);
    if (!wId) {
      throw new Error("Invalid workshop ID");
    }
    const workshop = await ctx.db.get(wId);
    if (!workshop) {
      throw new Error("Workshop not found");
    }

    const id = await ctx.db.insert("participants", {
      name: args.name,
      email: args.email,
      workshopId: args.workshopId,
      status: args.status || "registered",
      onboardingStatus: args.onboardingStatus || "pending",
      createdAt: Date.now(),
    });

    const inserted = await ctx.db.get(id);
    return formatParticipant(inserted);
  },
});

export const update = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.optional(v.string()),
    onboardingStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pId = ctx.db.normalizeId("participants", args.id);
    if (!pId) {
      throw new Error("Invalid participant ID");
    }

    const current = await ctx.db.get(pId);
    if (!current) {
      throw new Error("Participant not found");
    }

    const patchObj = {};
    if (args.name !== undefined) patchObj.name = args.name;
    if (args.email !== undefined) patchObj.email = args.email;
    if (args.status !== undefined) {
      const allowedStatus = ["registered", "confirmed", "declined"];
      if (!allowedStatus.includes(args.status)) {
        throw new Error(`Invalid status: ${args.status}`);
      }
      patchObj.status = args.status;
    }
    if (args.onboardingStatus !== undefined) {
      const allowedOnboarding = ["pending", "completed"];
      if (!allowedOnboarding.includes(args.onboardingStatus)) {
        throw new Error(`Invalid onboardingStatus: ${args.onboardingStatus}`);
      }
      patchObj.onboardingStatus = args.onboardingStatus;
    }

    await ctx.db.patch(pId, patchObj);
    const updated = await ctx.db.get(pId);
    return formatParticipant(updated);
  },
});
