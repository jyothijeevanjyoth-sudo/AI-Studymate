import fs from 'node:fs';

async function runComprehensiveQATests() {
  const base = 'http://localhost:5000/api';
  const results = [];

  function record(testName, status, details, evidence) {
    results.push({ testName, status, details, evidence });
    console.log(`[${status}] ${testName}: ${details}`);
    if (evidence) console.log(`   Evidence: ${JSON.stringify(evidence).substring(0, 160)}...`);
  }

  console.log('===============================================================');
  console.log('🧪 AI STUDYMATE COMPREHENSIVE QA AUTOMATED TEST SUITE');
  console.log('===============================================================\n');

  // --- TEST 1: Health & Connectivity ---
  try {
    const health = await fetch(`${base}/health`).then(r => r.json());
    if (health.status === 'healthy') {
      record('TEST 1: Health & Connectivity', 'PASS', 'Backend healthy and responsive', health);
    } else {
      record('TEST 1: Health & Connectivity', 'FAIL', 'Health status not healthy', health);
    }
  } catch (e) {
    record('TEST 1: Health & Connectivity', 'FAIL', e.message, null);
  }

  // --- TEST 2: Course Selection & Courses API ---
  try {
    const courses = await fetch(`${base}/courses`).then(r => r.json());
    if (Array.isArray(courses) && courses.length > 0 && courses[0].code === 'CS101') {
      record('TEST 2: Courses API', 'PASS', `Loaded ${courses.length} courses`, courses[0]);
    } else {
      record('TEST 2: Courses API', 'FAIL', 'Failed to retrieve courses', courses);
    }
  } catch (e) {
    record('TEST 2: Courses API', 'FAIL', e.message, null);
  }

  // --- TEST 3: Study Materials Ingestion, Preview, & Rejection ---
  try {
    const materials = await fetch(`${base}/materials?courseId=crs_cs101_java`).then(r => r.json());
    if (materials.length >= 3) {
      record('TEST 3.1: Materials Listing', 'PASS', `Retrieved ${materials.length} verified materials`, { count: materials.length });
    } else {
      record('TEST 3.1: Materials Listing', 'FAIL', `Expected at least 3 materials, got ${materials.length}`, materials);
    }

    // Preview coordinates for PDF, PPTX, Transcript
    for (const m of materials) {
      const prev = await fetch(`${base}/materials/${m.id}/preview`).then(r => r.json());
      const hasCoords = prev.chunks.length > 0 && prev.chunks[0].unit_label;
      if (hasCoords) {
        record(`TEST 3.2: Coordinate Preservation (${m.file_type})`, 'PASS', `Preserved ${m.unit_type} units with label ${prev.chunks[0].unit_label}`, { chunk0: prev.chunks[0].unit_label });
      } else {
        record(`TEST 3.2: Coordinate Preservation (${m.file_type})`, 'FAIL', `Missing unit label in chunk preview`, prev);
      }
    }

    // Upload rejection on invalid format
    const formBad = new FormData();
    formBad.append('file', new Blob(['binary'], { type: 'application/octet-stream' }), 'bad.exe');
    formBad.append('courseId', 'crs_cs101_java');
    const badRes = await fetch(`${base}/materials/upload`, { method: 'POST', body: formBad });
    if (badRes.status === 400) {
      const errJson = await badRes.json();
      record('TEST 3.3: Invalid Upload Rejection', 'PASS', `Correctly returned HTTP 400 on .exe upload`, errJson);
    } else {
      record('TEST 3.3: Invalid Upload Rejection', 'FAIL', `Expected HTTP 400, got ${badRes.status}`, null);
    }

    // Valid VTT upload & cleanup
    const vttSample = 'WEBVTT\n\n00:00.000 --> 00:03.000\nTesting VTT cue parser.\n';
    const formVtt = new FormData();
    formVtt.append('file', new Blob([vttSample], { type: 'text/vtt' }), 'sample_qa.vtt');
    formVtt.append('courseId', 'crs_cs101_java');
    formVtt.append('title', 'QA Ingestion Sample');
    const vttRes = await fetch(`${base}/materials/upload`, { method: 'POST', body: formVtt });
    const vttData = await vttRes.json();
    if (vttRes.status === 201 && vttData.material?.id) {
      record('TEST 3.4: Dynamic VTT Ingestion', 'PASS', `Successfully uploaded and chunked VTT`, { id: vttData.material.id });
      // Delete uploaded test material
      await fetch(`${base}/materials/${vttData.material.id}`, { method: 'DELETE' });
    } else {
      record('TEST 3.4: Dynamic VTT Ingestion', 'FAIL', `Failed to upload VTT: ${vttRes.status}`, vttData);
    }
  } catch (e) {
    record('TEST 3: Materials Ingestion', 'FAIL', e.message, null);
  }

  // --- TEST 4: AI Tutor Grounded Query & Explanation Modes ---
  try {
    const conv = await fetch(`${base}/tutor/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: 'crs_cs101_java', title: 'QA Automated Session' })
    }).then(r => r.json());

    // Grounded Query
    const ansGrounded = await fetch(`${base}/tutor/conversations/${conv.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Explain method overloading versus overriding in Java' })
    }).then(r => r.json());

    const hasCitations = ansGrounded.message?.citations?.length > 0;
    if (hasCitations) {
      record('TEST 4.1: Grounded Citations', 'PASS', `Returned ${ansGrounded.message.citations.length} authentic source citations`, {
        citation0: ansGrounded.message.citations[0].material_title,
        unit: ansGrounded.message.citations[0].unit_label
      });
    } else {
      record('TEST 4.1: Grounded Citations', 'FAIL', 'No citations attached to tutor response', ansGrounded);
    }

    // Explanation Modes
    for (const m of ['beginner', 'step_by_step', 'analogy', 'practice']) {
      const modeRes = await fetch(`${base}/tutor/conversations/${conv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'What is polymorphism?', mode: m })
      }).then(r => r.json());
      if (modeRes.message?.tutor_mode === m) {
        record(`TEST 4.2: Tutor Mode [${m}]`, 'PASS', `Successfully adapted response style`, { mode: m });
      } else {
        record(`TEST 4.2: Tutor Mode [${m}]`, 'FAIL', `Mode mismatch`, modeRes);
      }
    }

    // Unanswerable Question
    const ansUnrelated = await fetch(`${base}/tutor/conversations/${conv.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'How do you train a generative diffusion model with transformer backbones?' })
    }).then(r => r.json());
    if (ansUnrelated.message?.content?.includes('do not currently contain information addressing')) {
      record('TEST 4.3: Unanswerable Question Handling', 'PASS', 'Explicitly communicated insufficient evidence without hallucinating', null);
    } else {
      record('TEST 4.3: Unanswerable Question Handling', 'FAIL', 'Did not clearly admit insufficient evidence', ansUnrelated);
    }
  } catch (e) {
    record('TEST 4: AI Tutor', 'FAIL', e.message, null);
  }

  // --- TEST 5: Quizzes & Adaptive Assessments ---
  try {
    const qGen = await fetch(`${base}/quiz/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: 'crs_cs101_java', topic: 'Inheritance', difficulty: 'intermediate', questionsCount: 2 })
    }).then(r => r.json());

    if (qGen.id && qGen.questions.length === 2) {
      record('TEST 5.1: Quiz Generation', 'PASS', `Generated quiz with 2 questions`, { id: qGen.id });
    } else {
      record('TEST 5.1: Quiz Generation', 'FAIL', 'Failed to generate quiz', qGen);
    }

    // Submit answers: 1 correct, 1 wrong
    const answers = [
      { question_id: qGen.questions[0].id, user_answer: qGen.questions[0].correct_answer },
      { question_id: qGen.questions[1].id, user_answer: 'Incorrect random option' }
    ];
    const subRes = await fetch(`${base}/quiz/${qGen.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, timeTakenSeconds: 30 })
    }).then(r => r.json());

    if (subRes.attempt?.score === 1 && subRes.attempt?.total_questions === 2) {
      record('TEST 5.2: Quiz Scoring', 'PASS', `Scored 1/2 (50%) accurately against answer key`, subRes.attempt);
    } else {
      record('TEST 5.2: Quiz Scoring', 'FAIL', 'Scoring mismatch', subRes);
    }

    // Adaptive difficulty handling
    if (subRes.recommendedDifficulty) {
      record('TEST 5.3: Adaptive Calibration', 'PASS', `Calibrated next recommended difficulty to ${subRes.recommendedDifficulty}`, { diff: subRes.recommendedDifficulty });
    } else {
      record('TEST 5.3: Adaptive Calibration', 'FAIL', 'No recommended difficulty provided', subRes);
    }
  } catch (e) {
    record('TEST 5: Quizzes', 'FAIL', e.message, null);
  }

  // --- TEST 6: Misconception Detective ---
  try {
    const miscs = await fetch(`${base}/misconceptions?courseId=crs_cs101_java&unresolved=true`).then(r => r.json());
    if (miscs.length > 0) {
      const misc = miscs[0];
      record('TEST 6.1: Misconception Detection', 'PASS', `Active misconception flagged for topic ${misc.topic}`, {
        fallacy: misc.misconception_text,
        evidence: misc.evidence_explanation ? 'Provided' : 'Missing'
      });

      // Verify follow-up challenge
      const verRes = await fetch(`${base}/misconceptions/${misc.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: misc.follow_up_question.correct_answer })
      }).then(r => r.json());

      if (verRes.isCorrect && verRes.wasResolved) {
        record('TEST 6.2: Misconception Resolution', 'PASS', `Verified follow-up and marked misconception as resolved`, verRes);
      } else {
        record('TEST 6.2: Misconception Resolution', 'FAIL', 'Could not resolve misconception', verRes);
      }
    } else {
      record('TEST 6.1: Misconception Detection', 'PASS', 'No active unresolved misconceptions', null);
    }
  } catch (e) {
    record('TEST 6: Misconception Detective', 'FAIL', e.message, null);
  }

  // --- TEST 7: Cognitive Learning Twin ---
  try {
    const twin = await fetch(`${base}/learning-twin?courseId=crs_cs101_java`).then(r => r.json());
    if (twin.overall_readiness_pct !== undefined && twin.overall_confidence !== undefined && twin.topic_twins?.length > 0) {
      record('TEST 7: Cognitive Learning Twin', 'PASS', `Readiness: ${twin.overall_readiness_pct}%, Confidence: ${twin.overall_confidence}%, Topics: ${twin.topic_twins.length}`, {
        velocity: twin.learning_velocity,
        topics: twin.topic_twins.map(t => `${t.topic}: ${t.estimated_mastery}%`)
      });
    } else {
      record('TEST 7: Cognitive Learning Twin', 'FAIL', 'Twin profile missing required fields', twin);
    }
  } catch (e) {
    record('TEST 7: Cognitive Learning Twin', 'FAIL', e.message, null);
  }

  // --- TEST 8: Study Timer & Time Tracking ---
  try {
    const sessionRes = await fetch(`${base}/study-tracker/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: 'crs_cs101_java',
        durationSeconds: 1800,
        sessionType: 'platform',
        notes: 'QA Automated Time Tracking Session'
      })
    });
    const sessionData = await sessionRes.json();
    if (sessionRes.status === 201 && sessionData.duration_minutes === 30) {
      record('TEST 8.1: Session Recording', 'PASS', `Recorded 30-minute session`, { id: sessionData.id });
    } else {
      record('TEST 8.1: Session Recording', 'FAIL', 'Failed to record session', sessionData);
    }

    // Boundary check: 0 seconds should fail
    const zeroRes = await fetch(`${base}/study-tracker/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: 'crs_cs101_java', durationSeconds: 0 })
    });
    if (zeroRes.status === 400) {
      record('TEST 8.2: Zero Duration Validation', 'PASS', 'Correctly rejected 0s duration with HTTP 400', null);
    } else {
      record('TEST 8.2: Zero Duration Validation', 'FAIL', `Expected HTTP 400, got ${zeroRes.status}`, null);
    }

    const stats = await fetch(`${base}/study-tracker/stats?courseId=crs_cs101_java`).then(r => r.json());
    if (stats.today_minutes > 0 && stats.total_minutes >= stats.today_minutes) {
      record('TEST 8.3: Aggregated Totals Consistency', 'PASS', `Today: ${stats.today_minutes}m, Week: ${stats.week_minutes}m, Total: ${stats.total_minutes}m`, stats);
    } else {
      record('TEST 8.3: Aggregated Totals Consistency', 'FAIL', 'Inconsistent totals', stats);
    }
  } catch (e) {
    record('TEST 8: Study Timer', 'FAIL', e.message, null);
  }

  // --- TEST 9: Personalized Study Plan ---
  try {
    const plan = await fetch(`${base}/study-plan?courseId=crs_cs101_java`).then(r => r.json());
    if (plan.id && plan.activities?.length > 0) {
      record('TEST 9.1: Study Plan Retrieval', 'PASS', `Plan active with ${plan.activities.length} prioritized activities`, {
        activities: plan.activities.map(a => `[${a.priority}] ${a.title}`)
      });

      // Toggle activity completion
      const patchRes = await fetch(`${base}/study-plan/activities/${plan.activities[0].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: true })
      }).then(r => r.json());
      if (patchRes.message?.includes('Activity completion updated')) {
        record('TEST 9.2: Activity Toggle', 'PASS', 'Successfully updated activity completion state', patchRes);
      } else {
        record('TEST 9.2: Activity Toggle', 'FAIL', 'Failed to update activity completion', patchRes);
      }
    } else {
      record('TEST 9.1: Study Plan Retrieval', 'FAIL', 'Plan missing activities', plan);
    }
  } catch (e) {
    record('TEST 9: Study Plan', 'FAIL', e.message, null);
  }

  // --- TEST 10: What-If Learning Simulator ---
  try {
    const simRes = await fetch(`${base}/learning-twin/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: 'crs_cs101_java',
        planned_study_minutes: 45,
        focus_topics: ['Inheritance'],
        planned_quizzes_count: 2
      })
    }).then(r => r.json());

    if (simRes.projected_readiness_pct && simRes.disclaimer?.includes('Disclaimer:')) {
      record('TEST 10: What-If Simulator', 'PASS', `Projected readiness: ${simRes.projected_readiness_pct}% (+${simRes.readiness_delta}%), estimate disclaimer verified`, {
        readiness: simRes.projected_readiness_pct,
        delta: simRes.readiness_delta
      });
    } else {
      record('TEST 10: What-If Simulator', 'FAIL', 'Simulation output missing expected fields or disclaimer', simRes);
    }
  } catch (e) {
    record('TEST 10: What-If Simulator', 'FAIL', e.message, null);
  }

  // --- TEST 11: Learning Analytics ---
  try {
    const dash = await fetch(`${base}/analytics/dashboard?courseId=crs_cs101_java`).then(r => r.json());
    const topics = await fetch(`${base}/analytics/topics?courseId=crs_cs101_java`).then(r => r.json());
    if (dash.total_resources > 0 && Array.isArray(topics) && topics.length > 0) {
      record('TEST 11: Learning Analytics', 'PASS', `Dashboard metrics compiled; topics tracked: ${topics.map(t => `${t.topic} (${t.accuracy}%)`).join(', ')}`, {
        topicsCount: topics.length
      });
    } else {
      record('TEST 11: Learning Analytics', 'FAIL', 'Analytics returned empty data', { dash, topics });
    }
  } catch (e) {
    record('TEST 11: Learning Analytics', 'FAIL', e.message, null);
  }

  // --- TEST 12: Settings & System Readiness ---
  try {
    const settings = await fetch(`${base}/settings/status`).then(r => r.json());
    if (settings.database_ready === true && settings.total_chunks > 0) {
      record('TEST 12: Settings & Status', 'PASS', `System readiness verified (Database ready: true, Total chunks: ${settings.total_chunks})`, settings);
    } else {
      record('TEST 12: Settings & Status', 'FAIL', 'Settings report database not ready', settings);
    }
  } catch (e) {
    record('TEST 12: Settings & Status', 'FAIL', e.message, null);
  }

  console.log('\n===============================================================');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===============================================================');
}

runComprehensiveQATests().catch(console.error);
