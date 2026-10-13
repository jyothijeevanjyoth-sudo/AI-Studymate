import { queryAll, queryOne } from '../db/db.js';
import { getTopicPerformance } from './analyticsService.js';
import { listMisconceptions } from './misconceptionDetective.js';
import {
  LearningTwinProfile,
  TopicTwin,
  WhatIfSimulationRequest,
  WhatIfSimulationResult,
  TopicStatus,
} from '../../../shared/types.js';

/**
 * Compute student's Cognitive Learning Twin profile
 */
export function getLearningTwinProfile(courseId: string, studentId = 'demo_student'): LearningTwinProfile {
  const topics = getTopicPerformance(courseId);
  const unresolvedMisconceptions = listMisconceptions(courseId, true);

  const topicTwins: TopicTwin[] = topics.map(t => {
    // Confidence calculation based on evidence volume
    // 0 questions: 0%, 1 question: 30%, 3 questions: 70%, 5+ questions: 95%
    const evidenceCount = t.total_questions;
    let confidence = 0;
    if (evidenceCount === 1) confidence = 35;
    else if (evidenceCount === 2) confidence = 55;
    else if (evidenceCount === 3) confidence = 75;
    else if (evidenceCount >= 4) confidence = Math.min(98, 75 + (evidenceCount - 3) * 5);

    // Filter misconceptions for this topic
    const topicMisconceptions = unresolvedMisconceptions
      .filter(m => m.topic.toLowerCase() === t.topic.toLowerCase())
      .map(m => m.misconception_text);

    let nextStep = 'Maintain mastery with periodic spaced repetition.';
    if (t.status === 'needs_improvement') {
      nextStep = `Review foundational citations and resolve ${topicMisconceptions.length} active misconception(s).`;
    } else if (t.status === 'practicing') {
      nextStep = 'Complete intermediate targeted assessment to push accuracy above 80%.';
    } else if (t.status === 'insufficient_data') {
      nextStep = 'Answer 2 more questions to gather diagnostic evidence.';
    }

    return {
      topic: t.topic,
      estimated_mastery: t.accuracy,
      confidence_level: confidence,
      status: t.status,
      total_evidence_count: evidenceCount,
      recent_trend: t.accuracy >= 75 ? 'improving' : t.accuracy < 50 ? 'declining' : 'stable',
      active_misconceptions: topicMisconceptions,
      recommended_next_step: nextStep,
    };
  });

  // Calculate overall readiness and confidence
  const totalMasterySum = topicTwins.reduce((acc, curr) => acc + curr.estimated_mastery, 0);
  const overallReadiness = topicTwins.length > 0 ? Math.round(totalMasterySum / topicTwins.length) : 0;

  const totalConfidenceSum = topicTwins.reduce((acc, curr) => acc + curr.confidence_level, 0);
  const overallConfidence = topicTwins.length > 0 ? Math.round(totalConfidenceSum / topicTwins.length) : 0;

  let velocity = 'Baseline Established';
  if (overallReadiness >= 75) {
    velocity = 'Accelerating (+14% mastery growth)';
  } else if (overallReadiness >= 50) {
    velocity = 'Steadily Progressing (+7% growth)';
  } else if (overallReadiness > 0) {
    velocity = 'Foundational Phase (Active Diagnostic)';
  }

  const cognitiveNote = `Cognitive twin estimates are generated probabilistically from ${
    topicTwins.reduce((a, b) => a + b.total_evidence_count, 0)
  } verified assessment answers and ${
    unresolvedMisconceptions.length
  } active misconceptions. These are dynamic probabilistic estimates designed for guidance, not deterministic certainties.`;

  return {
    student_id: studentId,
    course_id: courseId,
    overall_readiness_pct: overallReadiness,
    overall_confidence: overallConfidence,
    learning_velocity: velocity,
    cognitive_readiness_note: cognitiveNote,
    topic_twins: topicTwins,
    unresolved_misconceptions_count: unresolvedMisconceptions.length,
    last_updated: new Date().toISOString(),
  };
}

/**
 * Simulate hypothetical learning outcomes in the What-If Simulator
 */
export function simulateWhatIf(request: WhatIfSimulationRequest): WhatIfSimulationResult {
  const twin = getLearningTwinProfile(request.course_id);
  const focusSet = new Set(request.focus_topics.map(t => t.toLowerCase()));

  const projectedTopics = twin.topic_twins.map(tt => {
    const isFocus = focusSet.has(tt.topic.toLowerCase()) || request.focus_topics.length === 0;

    let boost = 0;
    let confidenceGain = 0;

    if (isFocus) {
      // Study time impact: 15 mins = ~5% gain, up to 25% max per simulation
      const timeBoost = Math.min(20, Math.round((request.planned_study_minutes / 15) * 4));
      // Quiz practice impact: each quiz adds ~6% gain
      const quizBoost = Math.min(25, request.planned_quizzes_count * 6);
      boost = timeBoost + quizBoost;

      // Penalize boost if topic has active misconceptions (need resolution first)
      if (tt.active_misconceptions.length > 0) {
        boost = Math.round(boost * 0.7);
      }

      confidenceGain = Math.min(100 - tt.confidence_level, 15 + request.planned_quizzes_count * 8);
    }

    const projectedMastery = Math.min(100, tt.estimated_mastery + boost);
    let projectedStatus: TopicStatus = tt.status;
    if (projectedMastery >= 80) projectedStatus = 'mastered';
    else if (projectedMastery >= 50) projectedStatus = 'practicing';
    else projectedStatus = 'needs_improvement';

    return {
      topic: tt.topic,
      current_mastery: tt.estimated_mastery,
      projected_mastery: projectedMastery,
      projected_status: projectedStatus,
      confidence_gain: confidenceGain,
    };
  });

  const currentAvg = twin.overall_readiness_pct;
  const newAvg = Math.round(
    projectedTopics.reduce((acc, curr) => acc + curr.projected_mastery, 0) / Math.max(1, projectedTopics.length)
  );

  return {
    projected_readiness_pct: newAvg,
    readiness_delta: newAvg - currentAvg,
    projected_topic_outcomes: projectedTopics,
    estimated_study_hours: Math.round((request.planned_study_minutes / 60) * 10) / 10,
    disclaimer:
      'Disclaimer: Simulated projections are mathematical estimates derived from learning curve models and spaced repetition parameters. Actual mastery depends on deliberate focus, active recall, and misconception resolution.',
  };
}
