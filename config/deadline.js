export const SUBMISSION_DEADLINE = Date.UTC(2026, 8, 10, 0, 0, 0);

export const DEADLINE_LABEL = 'September 10, 2026 (00:00 UTC)';

export const REJECTED_MESSAGE = 'Something went wrong with form submission :(';

export function isPastDeadline(now = Date.now()) {
  return now > SUBMISSION_DEADLINE;
}