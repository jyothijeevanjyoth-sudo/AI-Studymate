async function testUploads() {
  const base = 'http://localhost:5000/api/materials';

  console.log('--- Test A: Unsupported file upload (.exe) ---');
  const formExe = new FormData();
  formExe.append('file', new Blob(['binary data'], { type: 'application/octet-stream' }), 'malicious.exe');
  formExe.append('courseId', 'crs_cs101_java');

  const resExe = await fetch(base + '/upload', { method: 'POST', body: formExe });
  const dataExe = await resExe.json();
  console.log('Status:', resExe.status, 'Error message:', dataExe.error);

  console.log('\n--- Test B: Valid WebVTT Upload ---');
  const vttContent = 'WEBVTT\n\n00:00.000 --> 00:04.000\nWelcome to Lecture 14 on Design Patterns in Java.\n\n00:04.500 --> 00:08.500\nToday we discuss the Singleton and Factory method patterns.\n';

  const formVtt = new FormData();
  formVtt.append('file', new Blob([vttContent], { type: 'text/vtt' }), 'lecture14_patterns.vtt');
  formVtt.append('courseId', 'crs_cs101_java');
  formVtt.append('title', 'Lecture 14: Design Patterns in Java');

  const resVtt = await fetch(base + '/upload', { method: 'POST', body: formVtt });
  const dataVtt = await resVtt.json();
  console.log('Status:', resVtt.status, 'Material ID:', dataVtt.material?.id, 'Total Units:', dataVtt.material?.total_units);

  if (dataVtt.material?.id) {
    const preview = await fetch(base + '/' + dataVtt.material.id + '/preview').then(r => r.json());
    console.log('Preview units:', preview.chunks.map(c => c.unit_label + ': ' + c.content));

    console.log('\n--- Test C: Delete Uploaded Material ---');
    const resDel = await fetch(base + '/' + dataVtt.material.id, { method: 'DELETE' });
    console.log('Delete status:', resDel.status, await resDel.json());
  }

  console.log('\n--- Test D: Missing courseId ---');
  const formNoCourse = new FormData();
  formNoCourse.append('file', new Blob(['Some notes'], { type: 'text/plain' }), 'notes.txt');
  const resNoCourse = await fetch(base + '/upload', { method: 'POST', body: formNoCourse });
  console.log('No CourseId Status:', resNoCourse.status, await resNoCourse.json());

  console.log('\n--- Test E: Non-existent courseId ---');
  const formBadCourse = new FormData();
  formBadCourse.append('file', new Blob(['Some notes'], { type: 'text/plain' }), 'notes.txt');
  formBadCourse.append('courseId', 'crs_non_existent');
  const resBadCourse = await fetch(base + '/upload', { method: 'POST', body: formBadCourse });
  console.log('Bad CourseId Status:', resBadCourse.status, await resBadCourse.json());
}

testUploads().catch(console.error);
