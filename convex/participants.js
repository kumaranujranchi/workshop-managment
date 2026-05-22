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
    status: v.optional(v.string()),
    onboardingStatus: v.optional(v.string()),
    expectations: v.optional(v.string()),
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

    // Capacity checking logic
    const capacity = workshop.capacity ?? 20;
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_workshopId", (q) => q.eq("workshopId", args.workshopId))
      .collect();
    const activeCount = participants.filter(
      (p) => p.status !== "declined" && p.status !== "waitlisted"
    ).length;

    let finalStatus = args.status;
    if (!finalStatus) {
      if (activeCount >= capacity) {
        finalStatus = "waitlisted";
      } else {
        finalStatus = "registered";
      }
    }

    const id = await ctx.db.insert("participants", {
      name: args.name,
      email: args.email,
      workshopId: args.workshopId,
      status: finalStatus,
      onboardingStatus: args.onboardingStatus || "pending",
      expectations: args.expectations || "",
      createdAt: Date.now(),
    });

    const inserted = await ctx.db.get(id);

    // Create simulated notifications
    if (finalStatus === "waitlisted") {
      await ctx.db.insert("notifications", {
        type: "email",
        recipient: args.email,
        subject: `Waitlisted: ${workshop.title}`,
        body: `Hi ${args.name},\n\nThe workshop "${workshop.title}" is currently at full capacity. You have been added to the waitlist. We will notify you if a seat becomes available.`,
        status: "sent",
        createdAt: Date.now(),
      });
    } else if (finalStatus === "registered" || finalStatus === "confirmed") {
      await ctx.db.insert("notifications", {
        type: "email",
        recipient: args.email,
        subject: `Registration Confirmed: ${workshop.title}`,
        body: `Hi ${args.name},\n\nYou are successfully registered for the workshop "${workshop.title}".\nDate/Time: ${workshop.dateTime || "TBD"}\n\nWe look forward to seeing you!`,
        status: "sent",
        createdAt: Date.now(),
      });
      await ctx.db.insert("notifications", {
        type: "calendar",
        recipient: args.email,
        subject: `Calendar Invitation: ${workshop.title}`,
        body: `Event: ${workshop.title}\nDate/Time: ${workshop.dateTime || "TBD"}\nLocation: Zoom / Online Meeting Link`,
        status: "sent",
        createdAt: Date.now(),
      });
    }

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
    expectations: v.optional(v.string()),
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

    const wId = ctx.db.normalizeId("workshops", current.workshopId);
    const workshop = wId ? await ctx.db.get(wId) : null;

    const patchObj = {};
    if (args.name !== undefined) patchObj.name = args.name;
    if (args.email !== undefined) patchObj.email = args.email;
    if (args.expectations !== undefined) patchObj.expectations = args.expectations;
    if (args.status !== undefined) {
      const allowedStatus = ["registered", "confirmed", "declined", "waitlisted"];
      if (!allowedStatus.includes(args.status)) {
        throw new Error(`Invalid status: ${args.status}`);
      }
      patchObj.status = args.status;

      // Handle transitions
      if (args.status === "declined" && current.status !== "declined") {
        // If the declining participant had a seat, free it and promote a waitlisted participant
        const wasOccupyingSeat = current.status === "registered" || current.status === "confirmed";
        if (wasOccupyingSeat && workshop) {
          const waitlisted = await ctx.db
            .query("participants")
            .withIndex("by_workshopId", (q) => q.eq("workshopId", current.workshopId))
            .collect();
          
          const oldestWaitlisted = waitlisted
            .filter((p) => p.status === "waitlisted")
            .sort((a, b) => (a.createdAt || a._creationTime) - (b.createdAt || b._creationTime))[0];

          if (oldestWaitlisted) {
            await ctx.db.patch(oldestWaitlisted._id, {
              status: "registered",
            });

            await ctx.db.insert("notifications", {
              type: "email",
              recipient: oldestWaitlisted.email,
              subject: `Seat Confirmed: ${workshop.title}`,
              body: `Hi ${oldestWaitlisted.name},\n\nYou have been promoted from the waitlist and registered for the workshop "${workshop.title}".\nDate/Time: ${workshop.dateTime || "TBD"}`,
              status: "sent",
              createdAt: Date.now(),
            });

            await ctx.db.insert("notifications", {
              type: "calendar",
              recipient: oldestWaitlisted.email,
              subject: `Calendar Invitation: ${workshop.title}`,
              body: `Event: ${workshop.title}\nDate/Time: ${workshop.dateTime || "TBD"}\nLocation: Zoom / Online Meeting Link`,
              status: "sent",
              createdAt: Date.now(),
            });
          }
        }

        // Send a revocation calendar invite
        if (workshop) {
          await ctx.db.insert("notifications", {
            type: "calendar",
            recipient: current.email,
            subject: `Revoked Invitation: ${workshop.title}`,
            body: `The calendar event for "${workshop.title}" has been cancelled.`,
            status: "revoked",
            createdAt: Date.now(),
          });
        }
      }
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

export const listNotifications = query({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.db.query("notifications").collect();
    return list.map(n => ({
      ...n,
      id: n._id,
    })).sort((a, b) => b.createdAt - a.createdAt);
  },
});
