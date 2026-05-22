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
  if (log.recommendedAction.includes('Send confirmation reminder')) {
    // In a real app, this sends emails. In our monolithic demo, we log this event.
    return { success: true, message: 'Confirmation reminder emails dispatched successfully!' };
  }
  if (log.recommendedAction.includes('onboarding reminder')) {
    return { success: true, message: 'Onboarding check email alerts triggered!' };
  }
  if (log.recommendedAction.includes('feedback collection campaign')) {
    return { success: true, message: 'Feedback survey requests successfully resent.' };
  }
  if (log.recommendedAction.includes('feedback alignment session')) {
    return { success: true, message: 'Calendar invitation sent to the facilitator for the alignment session.' };
  }
  
  return { success: true, message: 'Action executed successfully.' };
}
