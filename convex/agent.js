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

      // 5. Rule: Optimal timing suggestion (weekday -> Saturday rescheduling suggestion)
      if ((workshop.status === "draft" || workshop.status === "published") && workshop.dateTime) {
        const dtLower = workshop.dateTime.toLowerCase();
        const isWeekday = dtLower.includes("mon") || dtLower.includes("tue") || dtLower.includes("wed") || 
                          dtLower.includes("thu") || dtLower.includes("fri") ||
                          dtLower.includes("monday") || dtLower.includes("tuesday") || dtLower.includes("wednesday") ||
                          dtLower.includes("thursday") || dtLower.includes("friday");
        
        if (isWeekday) {
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
          
          const hasAction = existing.some((r) => r.recommendedAction.includes("Reschedule"));

          if (!hasAction) {
            await ctx.db.insert("agent_audit_logs", {
              targetType: "workshop",
              targetId: workshop._id,
              observation: `Workshop "${workshop.title}" is scheduled on a weekday (${workshop.dateTime}).`,
              reasoning: `Historical analytics show that weekend cohorts have a 40% higher confirmation rate and lower drop-off compared to mid-week sessions.`,
              recommendedAction: `Reschedule "${workshop.title}" to Saturday morning for optimal attendance.`,
              status: "proposed",
              createdAt: Date.now(),
            });
          }
        }
      }

      // 6. Rule: Design improvements based on comments keywords
      if (feedbackList.length > 0) {
        const keywords = ["rushed", "labs", "theory", "practical", "pacing", "slow"];
        let needsAdjustment = false;
        let foundWord = "";
        for (const fb of feedbackList) {
          if (fb.comments) {
            const commentLower = fb.comments.toLowerCase();
            const matched = keywords.find(word => commentLower.includes(word));
            if (matched) {
              needsAdjustment = true;
              foundWord = matched;
              break;
            }
          }
        }

        if (needsAdjustment) {
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

          const hasAction = existing.some((r) => r.recommendedAction.includes("interactive hands-on"));

          if (!hasAction) {
            await ctx.db.insert("agent_audit_logs", {
              targetType: "workshop",
              targetId: workshop._id,
              observation: `Feedback comments for "${workshop.title}" mentioned curriculum pacing or hands-on practice (keyword: "${foundWord}").`,
              reasoning: `Participants request more practical interaction. Modifying the workshop syllabus to include structured lab work increases user satisfaction by 25%.`,
              recommendedAction: `Add interactive hands-on lab modules to "${workshop.title}" curriculum.`,
              status: "proposed",
              createdAt: Date.now(),
            });
          }
        }
      }

      // 7. Rule: Smart expectation nudges
      const hasExpectations = participants.some(p => p.expectations && p.expectations.trim().length > 0);
      if (workshop.status === "published" && hasExpectations) {
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

        const hasAction = existing.some((r) => r.recommendedAction.includes("prep reading"));

        if (!hasAction) {
          await ctx.db.insert("agent_audit_logs", {
            targetType: "workshop",
            targetId: workshop._id,
            observation: `Workshop "${workshop.title}" has detailed pre-session expectations logged by participants.`,
            reasoning: `Proactively sharing a reading list tailored to topics of interest improves initial session engagement and saves 15 minutes of introductory lecturing.`,
            recommendedAction: `Send prep reading materials nudge to participants of "${workshop.title}".`,
            status: "proposed",
            createdAt: Date.now(),
          });
        }
      }
    }

    // 8. Rule: Identify drop-offs (declined >= 2 workshops)
    const allParticipants = await ctx.db.query("participants").collect();
    const emailGroups = {};
    allParticipants.forEach(p => {
      if (!emailGroups[p.email]) {
        emailGroups[p.email] = { name: p.name, email: p.email, declinedCount: 0 };
      }
      if (p.status === "declined") {
        emailGroups[p.email].declinedCount++;
      }
    });

    for (const group of Object.values(emailGroups)) {
      if (group.declinedCount >= 2) {
        const existing = await ctx.db
          .query("agent_audit_logs")
          .filter((q) =>
            q.and(
              q.eq(q.field("targetType"), "participant"),
              q.eq(q.field("targetId"), group.email),
              q.eq(q.field("status"), "proposed")
            )
          )
          .collect();
        
        if (existing.length === 0) {
          await ctx.db.insert("agent_audit_logs", {
            targetType: "participant",
            targetId: group.email,
            observation: `Participant ${group.name} (${group.email}) has declined ${group.declinedCount} workshops.`,
            reasoning: `Multiple cancellations indicate potential disengagement or scheduling conflicts. A direct HR check-in email helps address feedback and retain them.`,
            recommendedAction: `Send personal drop-off check-in email to ${group.name} (${group.email}).`,
            status: "proposed",
            createdAt: Date.now(),
          });
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

    let message = "Action executed successfully.";

    // Get target workshop if targetType is workshop
    let workshop = null;
    let facilitator = null;
    let participants = [];
    if (log.targetType === "workshop") {
      const wId = ctx.db.normalizeId("workshops", log.targetId);
      if (wId) {
        workshop = await ctx.db.get(wId);
        if (workshop) {
          participants = await ctx.db
            .query("participants")
            .withIndex("by_workshopId", (q) => q.eq("workshopId", workshop._id))
            .collect();
          
          const facId = ctx.db.normalizeId("facilitators", workshop.facilitatorId);
          if (facId) facilitator = await ctx.db.get(facId);
        }
      }
    }

    if (log.recommendedAction.includes("Send confirmation reminder")) {
      const pending = participants.filter(p => p.status === "registered");
      for (const p of pending) {
        await ctx.db.insert("notifications", {
          type: "email",
          recipient: p.email,
          subject: `Urgent Reminder: Confirm Attendance for ${workshop.title}`,
          body: `Hi ${p.name},\n\nPlease confirm your attendance for the upcoming workshop "${workshop.title}". Log into the dashboard and set your status.`,
          status: "sent",
          createdAt: Date.now(),
        });
      }
      message = `Confirmation reminder emails dispatched successfully to ${pending.length} participants!`;
    } else if (log.recommendedAction.includes("onboarding reminder")) {
      const pending = participants.filter(p => p.onboardingStatus === "pending");
      for (const p of pending) {
        await ctx.db.insert("notifications", {
          type: "email",
          recipient: p.email,
          subject: `Reminder: Complete Onboarding Checklist for ${workshop.title}`,
          body: `Hi ${p.name},\n\nThis is a quick reminder to complete your onboarding details before the "${workshop.title}" workshop starts.`,
          status: "sent",
          createdAt: Date.now(),
        });
      }
      message = `Onboarding check email alerts triggered for ${pending.length} participants!`;
    } else if (log.recommendedAction.includes("feedback collection campaign")) {
      const active = participants.filter(p => p.status === "confirmed" || p.status === "registered");
      // Resend to those who didn't submit feedback yet
      const feedback = await ctx.db
        .query("feedback")
        .withIndex("by_workshopId", (q) => q.eq("workshopId", workshop._id))
        .collect();
      const submittedIds = new Set(feedback.map(f => f.participantId));
      const pendingFeedback = active.filter(p => !submittedIds.has(p._id.toString()));

      for (const p of pendingFeedback) {
        await ctx.db.insert("notifications", {
          type: "email",
          recipient: p.email,
          subject: `Share Your Feedback: ${workshop.title}`,
          body: `Hi ${p.name},\n\nThe workshop "${workshop.title}" is complete. Please share your rating and review to help us improve.`,
          status: "sent",
          createdAt: Date.now(),
        });
      }
      message = `Feedback survey requests successfully resent to ${pendingFeedback.length} participants.`;
    } else if (log.recommendedAction.includes("feedback alignment session")) {
      if (facilitator && workshop) {
        await ctx.db.insert("notifications", {
          type: "calendar",
          recipient: facilitator.email,
          subject: `Facilitator Alignment: ${workshop.title} Feedback`,
          body: `Event: Feedback Post-Mortem & Alignment\nWorkshop: ${workshop.title}\nHost: HR Admin`,
          status: "sent",
          createdAt: Date.now(),
        });
      }
      message = "Calendar invitation sent to the facilitator for the alignment session.";
    } else if (log.recommendedAction.includes("Reschedule")) {
      if (workshop) {
        // Reschedule to a Saturday slot (e.g. next Saturday 10:00 AM)
        await ctx.db.patch(workshop._id, {
          dateTime: "Saturday, 10:00 AM (Rescheduled)",
          updatedAt: Date.now(),
        });
        const active = participants.filter(p => p.status !== "declined");
        for (const p of active) {
          await ctx.db.insert("notifications", {
            type: "calendar",
            recipient: p.email,
            subject: `Calendar Update: ${workshop.title}`,
            body: `Event: ${workshop.title} has been rescheduled to Saturday, 10:00 AM.\nLocation: Online Zoom`,
            status: "sent",
            createdAt: Date.now(),
          });
        }
      }
      message = `Rescheduled "${workshop?.title}" and sent calendar updates to active participants.`;
    } else if (log.recommendedAction.includes("interactive hands-on")) {
      if (facilitator && workshop) {
        await ctx.db.insert("notifications", {
          type: "email",
          recipient: facilitator.email,
          subject: `Curriculum Update Required: ${workshop.title}`,
          body: `Hi ${facilitator.name},\n\nBased on participant feedback analysis, we need to add a hands-on lab module to the "${workshop.title}" workshop. Let's update the syllabus details.`,
          status: "sent",
          createdAt: Date.now(),
        });
      }
      message = `Requested facilitator ${facilitator?.name} to integrate practical labs.`;
    } else if (log.recommendedAction.includes("prep reading")) {
      const active = participants.filter(p => p.status === "registered" || p.status === "confirmed");
      for (const p of active) {
        await ctx.db.insert("notifications", {
          type: "email",
          recipient: p.email,
          subject: `Pre-Workshop Reading Material: ${workshop.title}`,
          body: `Hi ${p.name},\n\nBased on your registered learning expectations, we have compiled a quick prep read: "Modern Frameworks & Best Practices". Feel free to check it before the session!`,
          status: "sent",
          createdAt: Date.now(),
        });
      }
      message = `Dispatched prep reading materials nudge to ${active.length} participants!`;
    } else if (log.recommendedAction.includes("drop-off check-in")) {
      await ctx.db.insert("notifications", {
        type: "email",
        recipient: log.targetId,
        subject: `Checking In: Learning & Development Workshops`,
        body: `Hi,\n\nWe noticed you declined the last few workshop invitations. We'd love to know if there's any scheduling conflict or topic adjustments we can make for you.`,
        status: "sent",
        createdAt: Date.now(),
      });
      message = `Personal drop-off check-in email sent to ${log.targetId}`;
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
