import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function formatLog(log) {
  if (!log) return log;
  return {
    ...log,
    id: log._id,
    createdAt: log.createdAt || log._creationTime,
  };
}

export const listRecommendations = query({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db.query("agent_audit_logs").collect();
    const result = [];
    for (const log of logs) {
      let workshopTitle = "";
      if (log.targetType === "workshop") {
        const wId = ctx.db.normalizeId("workshops", log.targetId);
        if (wId) {
          const workshop = await ctx.db.get(wId);
          if (workshop) {
            workshopTitle = workshop.title;
          }
        }
      }
      result.push({
        ...formatLog(log),
        workshopTitle,
      });
    }
    // Sort descending by createdAt
    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const runReasoning = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("[Convex Agent] Running reasoning loop...");

    // Get all workshops where status is not 'archived'
    const workshops = await ctx.db
      .query("workshops")
      .filter((q) => q.neq(q.field("status"), "archived"))
      .collect();

    for (const workshop of workshops) {
      // Get participants
      const participants = await ctx.db
        .query("participants")
        .withIndex("by_workshopId", (q) => q.eq("workshopId", workshop._id))
        .collect();

      // Get feedback
      const feedbackList = await ctx.db
        .query("feedback")
        .withIndex("by_workshopId", (q) => q.eq("workshopId", workshop._id))
        .collect();

      const totalParticipants = participants.length;
      const confirmedCount = participants.filter((p) => p.status === "confirmed").length;
      const pendingOnboardingCount = participants.filter((p) => p.onboardingStatus === "pending").length;

      // 1. Low confirmation rate: Published workshop, but low confirmation (less than 50% confirmed)
      if (workshop.status === "published" && totalParticipants > 0) {
        const confirmationRate = confirmedCount / totalParticipants;
        if (confirmationRate < 0.50) {
          // Check if recommendation already exists for this workshop
          const existing = await ctx.db
            .query("agent_audit_logs")
            .filter((q) =>
              q.and(
                q.eq(q.field("targetId"), workshop._id),
                q.eq(q.field("status"), "proposed"),
                q.eq(q.field("targetType"), "workshop")
              )
            )
            .collect();
          
          const hasAction = existing.some((r) => r.recommendedAction.includes("Send confirmation reminder"));

          if (!hasAction) {
            await ctx.db.insert("agent_audit_logs", {
              targetType: "workshop",
              targetId: workshop._id,
              observation: `Workshop "${workshop.title}" has a low attendance confirmation rate of ${(confirmationRate * 100).toFixed(0)}% (${confirmedCount}/${totalParticipants} confirmed).`,
              reasoning: `Based on historical attendance data, workshops with less than 50% confirmation 3 days before start face high dropouts. Sending a confirmation reminder nudges participants to secure their slots.`,
              recommendedAction: `Send confirmation reminder emails to ${totalParticipants - confirmedCount} pending participants.`,
              status: "proposed",
              createdAt: Date.now(),
            });
          }
        }
      }

      // 2. Case: Registration closed, but onboarding is incomplete
      if (workshop.status === "registration_closed" && totalParticipants > 0) {
        if (pendingOnboardingCount > 0) {
          const existing = await ctx.db
            .query("agent_audit_logs")
            .filter((q) =>
              q.and(
                q.eq(q.field("targetId"), workshop._id),
                q.eq(q.field("status"), "proposed"),
                q.eq(q.field("targetType"), "workshop")
              )
            )
            .collect();
          
          const hasAction = existing.some((r) => r.recommendedAction.includes("onboarding checklist"));

          if (!hasAction) {
            await ctx.db.insert("agent_audit_logs", {
              targetType: "workshop",
              targetId: workshop._id,
              observation: `Workshop "${workshop.title}" registration is closed, but ${pendingOnboardingCount}/${totalParticipants} registered participants have not completed their onboarding checklist.`,
              reasoning: `Onboarding completion is critical for facilitators to customize course content. Pre-workshop engagement drops by 40% if onboarding details are not received prior to session kickoff.`,
              recommendedAction: `Send automated onboarding reminder to ${pendingOnboardingCount} participants.`,
              status: "proposed",
              createdAt: Date.now(),
            });
          }
        }
      }

      // 3. Case: Completed workshop, feedback rate is low
      if (workshop.status === "completed") {
        const feedbackRate = totalParticipants > 0 ? feedbackList.length / totalParticipants : 0;
        if (feedbackRate < 0.60 && totalParticipants > 0) {
          const existing = await ctx.db
            .query("agent_audit_logs")
            .filter((q) =>
              q.and(
                q.eq(q.field("targetId"), workshop._id),
                q.eq(q.field("status"), "proposed"),
                q.eq(q.field("targetType"), "workshop")
              )
            )
            .collect();
          
          const hasAction = existing.some((r) => r.recommendedAction.includes("feedback campaign"));

          if (!hasAction) {
            await ctx.db.insert("agent_audit_logs", {
              targetType: "workshop",
              targetId: workshop._id,
              observation: `Workshop "${workshop.title}" is completed, but feedback response rate is only ${(feedbackRate * 100).toFixed(0)}% (${feedbackList.length}/${totalParticipants}).`,
              reasoning: `Incomplete feedback reduces the accuracy of workshop performance metrics. An automated follow-up survey usually boosts responses by 30%.`,
              recommendedAction: `Trigger automated feedback collection campaign for remaining ${totalParticipants - feedbackList.length} participants.`,
              status: "proposed",
              createdAt: Date.now(),
            });
          }
        }

        // 4. Case: Completed workshop, poor average rating (less than 3.8)
        if (feedbackList.length > 0) {
          const avgRating = feedbackList.reduce((acc, f) => acc + f.rating, 0) / feedbackList.length;
          if (avgRating < 3.8) {
            const existing = await ctx.db
              .query("agent_audit_logs")
              .filter((q) =>
                q.and(
                  q.eq(q.field("targetId"), workshop._id),
                  q.eq(q.field("status"), "proposed"),
                  q.eq(q.field("targetType"), "workshop")
                )
              )
              .collect();
            
            const hasAction = existing.some((r) => r.recommendedAction.includes("Facilitator feedback alignment"));

            if (!hasAction) {
              await ctx.db.insert("agent_audit_logs", {
                targetType: "workshop",
                targetId: workshop._id,
                observation: `Workshop "${workshop.title}" completed with low average feedback rating: ${avgRating.toFixed(1)}/5.0 based on ${feedbackList.length} reviews.`,
                reasoning: `Low course rating signals a mismatch in curriculum difficulty or facilitator delivery. Aligning with the facilitator to discuss feedback comments will prevent performance drops in future cohorts.`,
                recommendedAction: `Schedule a Facilitator feedback alignment session for "${workshop.title}".`,
                status: "proposed",
                createdAt: Date.now(),
              });
            }
          }
        }
      }
    }

    // Return the updated recommendations list
    const logs = await ctx.db.query("agent_audit_logs").collect();
    const result = [];
    for (const log of logs) {
      let workshopTitle = "";
      if (log.targetType === "workshop") {
        const wId = ctx.db.normalizeId("workshops", log.targetId);
        if (wId) {
          const workshop = await ctx.db.get(wId);
          if (workshop) {
            workshopTitle = workshop.title;
          }
        }
      }
      result.push({
        ...formatLog(log),
        workshopTitle,
      });
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const executeAction = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const logId = ctx.db.normalizeId("agent_audit_logs", args.id);
    if (!logId) {
      throw new Error("Invalid recommendation ID");
    }

    const log = await ctx.db.get(logId);
    if (!log) {
      throw new Error("Recommendation not found");
    }

    // Simulate occasional 25% failure rate for demonstration of failed workflow queues
    if (Math.random() < 0.25) {
      await ctx.db.patch(logId, { status: "failed" });
      return {
        success: false,
        error: "SMTP Gateway Timeout: Failed to dispatch automated messages. Log marked as failed.",
      };
    }

    await ctx.db.patch(logId, { status: "executed" });

    // Custom execution simulations based on action types:
    let message = "Action executed successfully.";
    if (log.recommendedAction.includes("Send confirmation reminder")) {
      message = "Confirmation reminder emails dispatched successfully!";
    } else if (log.recommendedAction.includes("onboarding reminder")) {
      message = "Onboarding check email alerts triggered!";
    } else if (log.recommendedAction.includes("feedback collection campaign")) {
      message = "Feedback survey requests successfully resent.";
    } else if (log.recommendedAction.includes("feedback alignment session")) {
      message = "Calendar invitation sent to the facilitator for the alignment session.";
    }

    return { success: true, message };
  },
});

export const dismissAction = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const logId = ctx.db.normalizeId("agent_audit_logs", args.id);
    if (!logId) {
      throw new Error("Invalid recommendation ID");
    }
    await ctx.db.patch(logId, { status: "dismissed" });
    return { success: true };
  },
});

export const updateRecommendationStatus = mutation({
  args: {
    id: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const logId = ctx.db.normalizeId("agent_audit_logs", args.id);
    if (!logId) {
      throw new Error("Invalid recommendation ID");
    }
    await ctx.db.patch(logId, { status: args.status });
    const updated = await ctx.db.get(logId);
    return formatLog(updated);
  },
});
