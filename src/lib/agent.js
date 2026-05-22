import db from './db.js';

// Random UUID generator helper
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Runs the Agentic AI reasoning loop over all workshops and generates actionable recommendations.
 */
export function runAgenticReasoning() {
  console.log('[Agentic AI] Running reasoning loop...');
  
  // Get all active workshops
  const workshops = db.prepare("SELECT * FROM workshops WHERE status != 'archived'").all();
  
  for (const workshop of workshops) {
    const participants = db.prepare('SELECT * FROM participants WHERE workshopId = ?').all(workshop.id);
    const feedbackList = db.prepare('SELECT * FROM feedback WHERE workshopId = ?').all(workshop.id);
    
    const totalParticipants = participants.length;
    const confirmedCount = participants.filter(p => p.status === 'confirmed').length;
    const pendingOnboardingCount = participants.filter(p => p.onboardingStatus === 'pending').length;
    
    // 1. Case: Published workshop, but low attendance confirmation (less than 50% confirmed)
    if (workshop.status === 'published' && totalParticipants > 0) {
      const confirmationRate = confirmedCount / totalParticipants;
      if (confirmationRate < 0.50) {
        // Check if recommendation already exists for this workshop
        const existing = db.prepare(`
          SELECT * FROM agent_audit_logs 
          WHERE targetId = ? AND status = 'proposed' AND recommendedAction LIKE '%Send confirmation reminder%'
        `).get(workshop.id);
        
        if (!existing) {
          db.prepare(`
            INSERT INTO agent_audit_logs (id, targetType, targetId, observation, reasoning, recommendedAction, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            generateId(),
            'workshop',
            workshop.id,
            `Workshop "${workshop.title}" has a low attendance confirmation rate of ${(confirmationRate * 100).toFixed(0)}% (${confirmedCount}/${totalParticipants} confirmed).`,
            `Based on historical attendance data, workshops with less than 50% confirmation 3 days before start face high dropouts. Sending a confirmation reminder nudges participants to secure their slots.`,
            `Send confirmation reminder emails to ${totalParticipants - confirmedCount} pending participants.`,
            'proposed'
          );
          console.log(`[Agentic AI] Created recommendation for workshop: ${workshop.title}`);
        }
      }
    }
    
    // 2. Case: Registration closed, but onboarding is incomplete
    if (workshop.status === 'registration_closed' && totalParticipants > 0) {
      if (pendingOnboardingCount > 0) {
        const existing = db.prepare(`
          SELECT * FROM agent_audit_logs 
          WHERE targetId = ? AND status = 'proposed' AND recommendedAction LIKE '%onboarding checklist%'
        `).get(workshop.id);
        
        if (!existing) {
          db.prepare(`
            INSERT INTO agent_audit_logs (id, targetType, targetId, observation, reasoning, recommendedAction, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            generateId(),
            'workshop',
            workshop.id,
            `Workshop "${workshop.title}" registration is closed, but ${pendingOnboardingCount}/${totalParticipants} registered participants have not completed their onboarding checklist.`,
            `Onboarding completion is critical for facilitators to customize course content. Pre-workshop engagement drops by 40% if onboarding details are not received prior to session kickoff.`,
            `Send automated onboarding reminder to ${pendingOnboardingCount} participants.`,
            'proposed'
          );
          console.log(`[Agentic AI] Created onboarding recommendation for: ${workshop.title}`);
        }
      }
    }
    
    // 3. Case: Completed workshop, feedback rate is low
    if (workshop.status === 'completed') {
      const feedbackRate = totalParticipants > 0 ? (feedbackList.length / totalParticipants) : 0;
      if (feedbackRate < 0.60 && totalParticipants > 0) {
        const existing = db.prepare(`
          SELECT * FROM agent_audit_logs 
          WHERE targetId = ? AND status = 'proposed' AND recommendedAction LIKE '%feedback campaign%'
        `).get(workshop.id);
        
        if (!existing) {
          db.prepare(`
            INSERT INTO agent_audit_logs (id, targetType, targetId, observation, reasoning, recommendedAction, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            generateId(),
            'workshop',
            workshop.id,
            `Workshop "${workshop.title}" is completed, but feedback response rate is only ${(feedbackRate * 100).toFixed(0)}% (${feedbackList.length}/${totalParticipants}).`,
            `Incomplete feedback reduces the accuracy of workshop performance metrics. An automated follow-up survey usually boosts responses by 30%.`,
            `Trigger automated feedback collection campaign for remaining ${totalParticipants - feedbackList.length} participants.`,
            'proposed'
          );
        }
      }
      
      // 4. Case: Completed workshop, poor average rating (less than 3.8)
      if (feedbackList.length > 0) {
        const avgRating = feedbackList.reduce((acc, f) => acc + f.rating, 0) / feedbackList.length;
        if (avgRating < 3.8) {
          const existing = db.prepare(`
            SELECT * FROM agent_audit_logs 
            WHERE targetId = ? AND status = 'proposed' AND recommendedAction LIKE '%Facilitator feedback alignment%'
        `).get(workshop.id);
          
          if (!existing) {
            db.prepare(`
              INSERT INTO agent_audit_logs (id, targetType, targetId, observation, reasoning, recommendedAction, status)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              generateId(),
              'workshop',
              workshop.id,
              `Workshop "${workshop.title}" completed with low average feedback rating: ${avgRating.toFixed(1)}/5.0 based on ${feedbackList.length} reviews.`,
              `Low course rating signals a mismatch in curriculum difficulty or facilitator delivery. Aligning with the facilitator to discuss feedback comments will prevent performance drops in future cohorts.`,
              `Schedule a Facilitator feedback alignment session for "${workshop.title}".`,
              'proposed'
            );
          }
        }
      }
    }
    // 5. Rule: Optimal timing suggestion (weekday -> Saturday rescheduling suggestion)
    if ((workshop.status === 'draft' || workshop.status === 'published') && workshop.dateTime) {
      const dtLower = workshop.dateTime.toLowerCase();
      const isWeekday = dtLower.includes('mon') || dtLower.includes('tue') || dtLower.includes('wed') || 
                        dtLower.includes('thu') || dtLower.includes('fri') ||
                        dtLower.includes('monday') || dtLower.includes('tuesday') || dtLower.includes('wednesday') ||
                        dtLower.includes('thursday') || dtLower.includes('friday');
      
      if (isWeekday) {
        const existing = db.prepare(`
          SELECT * FROM agent_audit_logs 
          WHERE targetId = ? AND status = 'proposed' AND recommendedAction LIKE 'Reschedule%'
        `).get(workshop.id);

        if (!existing) {
          db.prepare(`
            INSERT INTO agent_audit_logs (id, targetType, targetId, observation, reasoning, recommendedAction, status)
            VALUES (?, 'workshop', ?, ?, ?, ?, 'proposed')
          `).run(
            generateId(),
            workshop.id,
            `Workshop "${workshop.title}" is scheduled on a weekday (${workshop.dateTime}).`,
            `Historical analytics show that weekend cohorts have a 40% higher confirmation rate and lower drop-off compared to mid-week sessions.`,
            `Reschedule "${workshop.title}" to Saturday morning for optimal attendance.`
          );
        }
      }
    }

    // 6. Rule: Design improvements based on comments keywords
    if (feedbackList.length > 0) {
      const keywords = ['rushed', 'labs', 'theory', 'practical', 'pacing', 'slow'];
      let needsAdjustment = false;
      let foundWord = '';
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
        const existing = db.prepare(`
          SELECT * FROM agent_audit_logs 
          WHERE targetId = ? AND status = 'proposed' AND recommendedAction LIKE '%interactive hands-on%'
        `).get(workshop.id);

        if (!existing) {
          db.prepare(`
            INSERT INTO agent_audit_logs (id, targetType, targetId, observation, reasoning, recommendedAction, status)
            VALUES (?, 'workshop', ?, ?, ?, ?, 'proposed')
          `).run(
            generateId(),
            workshop.id,
            `Feedback comments for "${workshop.title}" mentioned curriculum pacing or hands-on practice (keyword: "${foundWord}").`,
            `Participants request more practical interaction. Modifying the workshop syllabus to include structured lab work increases user satisfaction by 25%.`,
            `Add interactive hands-on lab modules to "${workshop.title}" curriculum.`
          );
        }
      }
    }

    // 7. Rule: Smart expectation nudges
    const hasExpectations = participants.some(p => p.expectations && p.expectations.trim().length > 0);
    if (workshop.status === 'published' && hasExpectations) {
      const existing = db.prepare(`
        SELECT * FROM agent_audit_logs 
        WHERE targetId = ? AND status = 'proposed' AND recommendedAction LIKE '%prep reading%'
      `).get(workshop.id);

      if (!existing) {
        db.prepare(`
          INSERT INTO agent_audit_logs (id, targetType, targetId, observation, reasoning, recommendedAction, status)
          VALUES (?, 'workshop', ?, ?, ?, ?, 'proposed')
        `).run(
          generateId(),
          workshop.id,
          `Workshop "${workshop.title}" has detailed pre-session expectations logged by participants.`,
          `Proactively sharing a reading list tailored to topics of interest improves initial session engagement and saves 15 minutes of introductory lecturing.`,
          `Send prep reading materials nudge to participants of "${workshop.title}".`
        );
      }
    }
  }

  // 8. Rule: Identify drop-offs (declined >= 2 workshops)
  const allParticipants = db.prepare('SELECT * FROM participants').all();
  const emailGroups = {};
  allParticipants.forEach(p => {
    if (!emailGroups[p.email]) {
      emailGroups[p.email] = { name: p.name, email: p.email, declinedCount: 0 };
    }
    if (p.status === 'declined') {
      emailGroups[p.email].declinedCount++;
    }
  });

  for (const group of Object.values(emailGroups)) {
    if (group.declinedCount >= 2) {
      const existing = db.prepare(`
        SELECT * FROM agent_audit_logs 
        WHERE targetType = 'participant' AND targetId = ? AND status = 'proposed'
      `).get(group.email);
      
      if (!existing) {
        db.prepare(`
          INSERT INTO agent_audit_logs (id, targetType, targetId, observation, reasoning, recommendedAction, status)
          VALUES (?, 'participant', ?, ?, ?, ?, 'proposed')
        `).run(
          generateId(),
          group.email,
          `Participant ${group.name} (${group.email}) has declined ${group.declinedCount} workshops.`,
          `Multiple cancellations indicate potential disengagement or scheduling conflicts. A direct HR check-in email helps address feedback and retain them.`,
          `Send personal drop-off check-in email to ${group.name} (${group.email}).`
        );
      }
    }
  }
}

/**
 * Executes a recommended action when approved by HR Admin.
 */
export function executeAgenticAction(logId) {
  const log = db.prepare('SELECT * FROM agent_audit_logs WHERE id = ?').get(logId);
  if (!log) throw new Error('Recommendation not found.');
  
  // Simulate occasional 25% failure rate for demonstration of failed workflow queues
  if (Math.random() < 0.25) {
    db.prepare("UPDATE agent_audit_logs SET status = 'failed' WHERE id = ?").run(logId);
    console.log(`[Agentic AI] Execution failed for action: "${log.recommendedAction}"`);
    return {
      success: false,
      error: 'SMTP Gateway Timeout: Failed to dispatch automated messages. Log marked as failed.'
    };
  }

  // Mark recommendation as executed
  db.prepare("UPDATE agent_audit_logs SET status = 'executed' WHERE id = ?").run(logId);
  
  console.log(`[Agentic AI] Executed action: "${log.recommendedAction}" for target: ${log.targetId}`);
  
  // Custom execution simulations based on action types:
  let workshop = null;
  let facilitator = null;
  let participants = [];
  if (log.targetType === 'workshop') {
    workshop = db.prepare('SELECT * FROM workshops WHERE id = ?').get(log.targetId);
    if (workshop) {
      participants = db.prepare('SELECT * FROM participants WHERE workshopId = ?').all(workshop.id);
      facilitator = db.prepare('SELECT * FROM facilitators WHERE id = ?').get(workshop.facilitatorId);
    }
  }

  if (log.recommendedAction.includes('Send confirmation reminder')) {
    const pending = participants.filter(p => p.status === 'registered');
    for (const p of pending) {
      db.prepare(`
        INSERT INTO notifications (id, type, recipient, subject, body, status)
        VALUES (?, 'email', ?, ?, ?, 'sent')
      `).run(
        generateId(),
        p.email,
        `Urgent Reminder: Confirm Attendance for ${workshop.title}`,
        `Hi ${p.name},\n\nPlease confirm your attendance for the upcoming workshop "${workshop.title}". Log into the dashboard and set your status.`
      );
    }
    return { success: true, message: `Confirmation reminder emails dispatched successfully to ${pending.length} participants!` };
  }
  if (log.recommendedAction.includes('onboarding reminder')) {
    const pending = participants.filter(p => p.onboardingStatus === 'pending');
    for (const p of pending) {
      db.prepare(`
        INSERT INTO notifications (id, type, recipient, subject, body, status)
        VALUES (?, 'email', ?, ?, ?, 'sent')
      `).run(
        generateId(),
        p.email,
        `Reminder: Complete Onboarding Checklist for ${workshop.title}`,
        `Hi ${p.name},\n\nThis is a quick reminder to complete your onboarding details before the "${workshop.title}" workshop starts.`
      );
    }
    return { success: true, message: `Onboarding check email alerts triggered for ${pending.length} participants!` };
  }
  if (log.recommendedAction.includes('feedback collection campaign')) {
    const active = participants.filter(p => p.status === 'confirmed' || p.status === 'registered');
    const feedback = db.prepare('SELECT * FROM feedback WHERE workshopId = ?').all(workshop.id);
    const submittedIds = new Set(feedback.map(f => f.participantId));
    const pendingFeedback = active.filter(p => !submittedIds.has(p.id));

    for (const p of pendingFeedback) {
      db.prepare(`
        INSERT INTO notifications (id, type, recipient, subject, body, status)
        VALUES (?, 'email', ?, ?, ?, 'sent')
      `).run(
        generateId(),
        p.email,
        `Share Your Feedback: ${workshop.title}`,
        `Hi ${p.name},\n\nThe workshop "${workshop.title}" is complete. Please share your rating and review to help us improve.`
      );
    }
    return { success: true, message: `Feedback survey requests successfully resent to ${pendingFeedback.length} participants.` };
  }
  if (log.recommendedAction.includes('feedback alignment session')) {
    if (facilitator && workshop) {
      db.prepare(`
        INSERT INTO notifications (id, type, recipient, subject, body, status)
        VALUES (?, 'calendar', ?, ?, ?, 'sent')
      `).run(
        generateId(),
        facilitator.email,
        `Facilitator Alignment: ${workshop.title} Feedback`,
        `Event: Feedback Post-Mortem & Alignment\nWorkshop: ${workshop.title}\nHost: HR Admin`
      );
    }
    return { success: true, message: 'Calendar invitation sent to the facilitator for the alignment session.' };
  }
  if (log.recommendedAction.includes('Reschedule')) {
    if (workshop) {
      db.prepare("UPDATE workshops SET dateTime = 'Saturday, 10:00 AM (Rescheduled)', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(workshop.id);
      const active = participants.filter(p => p.status !== 'declined');
      for (const p of active) {
        db.prepare(`
          INSERT INTO notifications (id, type, recipient, subject, body, status)
          VALUES (?, 'calendar', ?, ?, ?, 'sent')
        `).run(
          generateId(),
          p.email,
          `Calendar Update: ${workshop.title}`,
          `Event: ${workshop.title} has been rescheduled to Saturday, 10:00 AM.\nLocation: Online Zoom`
        );
      }
    }
    return { success: true, message: `Rescheduled "${workshop?.title}" and sent calendar updates to active participants.` };
  }
  if (log.recommendedAction.includes('interactive hands-on')) {
    if (facilitator && workshop) {
      db.prepare(`
        INSERT INTO notifications (id, type, recipient, subject, body, status)
        VALUES (?, 'email', ?, ?, ?, 'sent')
      `).run(
        generateId(),
        facilitator.email,
        `Curriculum Update Required: ${workshop.title}`,
        `Hi ${facilitator.name},\n\nBased on participant feedback analysis, we need to add a hands-on lab module to the "${workshop.title}" workshop. Let's update the syllabus details.`
      );
    }
    return { success: true, message: `Requested facilitator ${facilitator?.name} to integrate practical labs.` };
  }
  if (log.recommendedAction.includes('prep reading')) {
    const active = participants.filter(p => p.status === 'registered' || p.status === 'confirmed');
    for (const p of active) {
      db.prepare(`
        INSERT INTO notifications (id, type, recipient, subject, body, status)
        VALUES (?, 'email', ?, ?, ?, 'sent')
      `).run(
        generateId(),
        p.email,
        `Pre-Workshop Reading Material: ${workshop.title}`,
        `Hi ${p.name},\n\nBased on your registered learning expectations, we have compiled a quick prep read: "Modern Frameworks & Best Practices". Feel free to check it before the session!`
      );
    }
    return { success: true, message: `Dispatched prep reading materials nudge to ${active.length} participants!` };
  }
  if (log.recommendedAction.includes('drop-off check-in')) {
    db.prepare(`
      INSERT INTO notifications (id, type, recipient, subject, body, status)
      VALUES (?, 'email', ?, ?, ?, 'sent')
    `).run(
      generateId(),
      log.targetId,
      `Checking In: Learning & Development Workshops`,
      `Hi,\n\nWe noticed you declined the last few workshop invitations. We'd love to know if there's any scheduling conflict or topic adjustments we can make for you.`
    );
    return { success: true, message: `Personal drop-off check-in email sent to ${log.targetId}` };
  }
  
  return { success: true, message: 'Action executed successfully.' };
}
