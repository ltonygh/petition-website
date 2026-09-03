import StudentInfo from '../models/StudentInfo.js';
import { incrementCounter } from '../models/Counter.js';
import { isPastDeadline } from '../config/deadline.js';



const SID_PATTERN = /^[0-9]{8}$/;
const YEAR_PATTERN = /^\d{4}$/;
const DATA_URL_PREFIX = 'data:image/';

function normalize(raw) {
  const str = typeof raw === 'string' ? raw : '';
  return str.trim();
}



async function verifyTurnstile(token, remoteIp) {
  const siteSecret = process.env.TURNSTILE_SECRET || process.env.TURNSTILE_SECRETKEY;
  const verifyUrl =
    process.env.TURNSTILE_VERIFY_URL ||
    'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  if (!siteSecret || !token) {
    if (!siteSecret) console.error('[turnstile] TURNSTILE_SECRET is not set.');
    return { success: false };
  }

  const body = new URLSearchParams({
    secret: siteSecret,
    response: token,
  });
  if (remoteIp) body.append('remoteip', remoteIp);

  let serviceResponse;
  try {
    const res = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    serviceResponse = await res.json();
  } catch (err) {
    console.error('[turnstile] could not reach siteverify:', err?.message);
    return { success: false };
  }

  if (serviceResponse?.success !== true) {
    console.error(
      '[turnstile] verification FAILED. cloudflare response:',
      JSON.stringify(serviceResponse)
    );
  } else {
    console.log('[turnstile] verification passed.');
  }

  return { success: serviceResponse?.success === true };
}



function checkConstraints(raw) {
  const errors = [];

  const name = normalize(raw.name);
  if (!name || name.length === 0 || name.length > 60) errors.push('name');

  const studentID = normalize(raw.studentID);
  if (!SID_PATTERN.test(studentID)) errors.push('studentID');

  const major = normalize(raw.major);
  if (!major || major.length === 0 || major.length > 60) errors.push('major');

  const cohort = normalize(raw.cohort);
  if (!cohort || !YEAR_PATTERN.test(cohort)) {
    errors.push('cohort');
  } else {
    const cohortYear = parseInt(cohort, 10);
    if (cohortYear < 2026 || cohortYear > 2036) {
      errors.push('cohort');
    }
  }

  const comments = normalize(raw.comments);
  if (comments && comments.length > 200) errors.push('comments');


  const signature = normalize(raw.signature ?? raw.signatureData);
  const signatureOk =
    signature.startsWith('data:image/') &&
    signature.length > DATA_URL_PREFIX.length &&
    Buffer.byteLength(signature, 'utf8') < 4_000_000;
  if (!signatureOk) errors.push('signature');

  return errors;
}



export async function runSubmission(input, { remoteIp } = {}) {
  const turnstile = await verifyTurnstile(input.turnstileToken, remoteIp);
  if (!turnstile.success) return { ok: false, reason: 'turnstile' };

  if (isPastDeadline()) return { ok: false, reason: 'late' };

  const problems = checkConstraints(input);
  if (problems.length > 0) return { ok: false, reason: 'constraints' };

  const existing = await StudentInfo.findOne({ studentID: studentID });
  if (existing) return { ok: false, reason: 'Duplicate ID already exist.' };

  await StudentInfo.create({
    name: normalize(input.name),
    studentID: studentID,
    major: normalize(input.major),
    cohort: normalize(input.cohort),
    comments: normalize(input.comments),
    signature: normalize(input.signature ?? input.signatureData),
  });

  await incrementCounter();

  return { ok: true };
}



export const REASONS = {
  turnstile: 'turnstile',
  late: 'late',
  constraints: 'constraints',
  duplicate: 'duplicate',
};