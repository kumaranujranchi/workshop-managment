import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  facilitators: defineTable({
    name: v.string(),
    email: v.string(),
  }).index("by_email", ["email"]),

  workshops: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    facilitatorId: v.string(),
    status: v.string(), // 'draft', 'published', 'registration_closed', 'completed', 'archived'
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }),

  participants: defineTable({
    name: v.string(),
    email: v.string(),
    workshopId: v.string(),
    status: v.string(), // 'registered', 'confirmed', 'declined'
    onboardingStatus: v.string(), // 'pending', 'completed'
    createdAt: v.optional(v.number()),
  }).index("by_workshopId", ["workshopId"]),

  feedback: defineTable({
    workshopId: v.string(),
    participantId: v.string(),
    rating: v.number(),
    comments: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  }).index("by_workshopId", ["workshopId"]),

  agent_audit_logs: defineTable({
    targetType: v.string(),
    targetId: v.string(),
    observation: v.string(),
    reasoning: v.string(),
    recommendedAction: v.string(),
    status: v.string(), // 'proposed', 'approved', 'dismissed', 'executed', 'failed'
    createdAt: v.optional(v.number()),
  }),
});
