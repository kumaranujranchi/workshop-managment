import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper to map _id to id for client compatibility
function formatFacilitator(fac) {
  if (!fac) return fac;
  return {
    ...fac,
    id: fac._id,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.db.query("facilitators").collect();
    return list.map(formatFacilitator);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Check email uniqueness
    const existing = await ctx.db
      .query("facilitators")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    if (existing) {
      throw new Error(`Email "${args.email}" is already in use.`);
    }

    const id = await ctx.db.insert("facilitators", {
      name: args.name,
      email: args.email,
    });

    const inserted = await ctx.db.get(id);
    return formatFacilitator(inserted);
  },
});

export const update = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const facId = ctx.db.normalizeId("facilitators", args.id);
    if (!facId) {
      throw new Error("Invalid facilitator ID");
    }

    const current = await ctx.db.get(facId);
    if (!current) {
      throw new Error("Facilitator not found");
    }

    if (args.email && args.email !== current.email) {
      // Check email uniqueness
      const existing = await ctx.db
        .query("facilitators")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .first();
      if (existing) {
        throw new Error(`Email "${args.email}" is already in use.`);
      }
    }

    await ctx.db.patch(facId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.email !== undefined ? { email: args.email } : {}),
    });

    const updated = await ctx.db.get(facId);
    return formatFacilitator(updated);
  },
});

export const remove = mutation({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const facId = ctx.db.normalizeId("facilitators", args.id);
    if (!facId) {
      throw new Error("Invalid facilitator ID");
    }

    // Check if facilitator has workshops
    const workshops = await ctx.db
      .query("workshops")
      .filter((q) => q.eq(q.field("facilitatorId"), args.id))
      .collect();

    if (workshops.length > 0) {
      throw new Error("Cannot delete facilitator with active workshops.");
    }

    await ctx.db.delete(facId);
    return { success: true };
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("facilitators").collect();
    if (existing.length === 0) {
      const f1 = await ctx.db.insert("facilitators", {
        name: "Amit Sharma",
        email: "amit.sharma@example.com",
      });
      const f2 = await ctx.db.insert("facilitators", {
        name: "Priya Patel",
        email: "priya.patel@example.com",
      });
      const f3 = await ctx.db.insert("facilitators", {
        name: "Dr. Rajesh Kumar",
        email: "rajesh.kumar@example.com",
      });
      return { seeded: true, count: 3 };
    }
    return { seeded: false, count: existing.length };
  },
});
