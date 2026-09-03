(function () {
  'use strict';

  const CFG = window.__APP_CONFIG__ || {};
  const DEADLINE = typeof CFG.deadline === 'number'
    ? new Date(CFG.deadline)
    : new Date(Date.UTC(2026, 8, 10, 0, 0, 0));
  const SITEKEY = CFG.sitekey || '';
  const DEADLINE_LABEL = CFG.deadlineLabel || 'September 10, 2026 (00:00 UTC)';


  const $ = (id) => document.getElementById(id);
  const formCard = $('formCard');
  const form = $('petitionForm');
  const successView = $('successView');
  const errorBanner = $('errorBanner');
  const countdownEl = $('countdown');
  const countdownDeadlineEl = $('countdownDeadline');
  const studentCountEl = $('studentCount');
  const submitBtn = $('submitBtn');
  const formLockedNote = $('formLockedNote');

  const canvas = $('signaturePad');
  const signatureDataInput = $('signatureData');

  const counters = {
    name: { input: $('name'), label: $('nameCount'), max: 60 },
    major: { input: $('major'), label: $('majorCount'), max: 60 },
    comments: { input: $('comments'), label: $('commentsCount'), max: 200 },
  };

  let signaturePad = null;
  let isLocked = false;
  let bootedOnce = false;



  function initSignaturePad() {
    function resizeCanvas() {
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = (rect.width || 640) * ratio;
      canvas.height = (rect.height || 160) * ratio;
      canvas.style.width = rect.width + 'px';
      if (signaturePad) {
        signaturePad.clear();
        const ctx = canvas.getContext('2d');
        ctx.scale(ratio, ratio);
      }
    }

    if (window.SignaturePad) {
      signaturePad = new window.SignaturePad(canvas, {
        minWidth: 0.6,
        maxWidth: 2.5,
        penColor: '#1e293b',
        backgroundColor: 'rgba(255,255,255,0)',
      });
      window.addEventListener('resize', resizeCanvas);
      requestAnimationFrame(resizeCanvas);
    } else {
      console.warn(
        'signature_pad library did not load. Check the CDN <script> tag in index.html.'
      );
    }
  }

  const SID_PATTERN = /^[0-9]{8}$/;
  const YEAR_PATTERN = /^\d{4}$/;



  function getFieldValues() {
    return {
      name: (form.name.value || '').trim(),
      studentID: (form.studentID.value || '').trim(),
      major: (form.major.value || '').trim(),
      cohort: (form.cohort.value || '').trim(),
      comments: (form.comments.value || '').trim(),
    };
  }

  function validateClientFields(attempt = true) {
    const problems = [];
    const v = getFieldValues();

    if (!v.name) problems.push('Name is required');
    if (v.name && v.name.length > 60) problems.push('Name exceeds 60 characters');

    if (!SID_PATTERN.test(v.studentID))
      problems.push('Student ID should be 8-digits long');

    if (!v.major) problems.push('Major is required');
    if (v.major && v.major.length > 60) problems.push('Major name exceeds 60 characters');

    if (!v.cohort) problems.push('Cohort is required');
    if (v.cohort && !YEAR_PATTERN.test(v.cohort))
      problems.push('Cohort must be a valid year');

    if (v.comments && v.comments.length > 200)
      problems.push('Comments exceed 200 characters');

    const sigEmpty = !signaturePad || signaturePad.isEmpty();
    if (sigEmpty) problems.push('Please provide your signature');

    if (attempt && problems.length) showClientErrors(problems);
    return { valid: problems.length === 0, problems };
  }

  function showClientErrors(problems) {
    showBanner(true);
    console.warn('Client validation failed:', problems);
  }



  function renderCountdown() {
    countdownDeadlineEl.textContent =
      'Closes at ' + DEADLINE_LABEL;

    const now = Date.now();
    const remain = DEADLINE.getTime() - now;

    if (remain <= 0) {
      countdownEl.textContent = '0d 00h 00m 00s';
      if (bootedOnce) enterLockedState();
      return;
    }

    const d = Math.floor(remain / 86400000);
    const h = Math.floor((remain % 86400000) / 3600000);
    const m = Math.floor((remain % 3600000) / 60000);
    const s = Math.floor((remain % 60000) / 1000);

    const pad2 = (n) => String(n).padStart(2, '0');
    countdownEl.textContent = `${d}d ${pad2(h)}h ${pad2(m)}m ${pad2(s)}s`;
  }

  async function refreshCount() {
    try {
      const res = await fetch('/api/count');
      const data = await res.json();
      if (typeof data.count === 'number') {
        studentCountEl.textContent = String(data.count);
      }
    } catch (err) {
      console.warn('Could not load counter.', err);
    }
  }



  function enterFormState(locked = false) {
    formCard.classList.remove('hidden');
    successView.classList.add('hidden');
    hideBanner();
    formLockedNote.classList.add('hidden');
    submitBtn.textContent = locked ? 'Submissions Closed' : 'Submit Signature';
    setFormDisabled(locked);
  }

  function enterLockedState() {
    if (isLocked) return;
    isLocked = true;
    setFormDisabled(true);
    submitBtn.textContent = 'Submissions Closed';
    formLockedNote.classList.remove('hidden');
  }

  function enterSuccessState() {
    formCard.classList.add('hidden');
    successView.classList.remove('hidden');
    hideBanner();
    refreshCount();
    const link = window.location.origin + '/';
    $('shareableLink').textContent = link;
  }

  function enterRejectedState() {
    showBanner(true);
    if (!isLocked) setFormDisabled(false);
    resetTurnstile();
  }



  function setFormDisabled(disabled) {
    const fields = form.querySelectorAll(
      'input, textarea, button[type=submit], #clearSignature'
    );
    fields.forEach((el) => (el.disabled = disabled));
    if (disabled) {
      try { if (signaturePad) signaturePad.off(); } catch (e) { }
    } else {
      try { if (signaturePad) signaturePad.on(); } catch (e) { }
    }
  }

  function showBanner(show) {
    if (show) errorBanner.classList.remove('hidden');
    else errorBanner.classList.add('hidden');
  }
  function hideBanner() {
    showBanner(false);
  }



  function bindCounters() {
    Object.values(counters).forEach(({ input, label, max }) => {
      if (!input || !label) return;
      const update = () => {
        label.textContent = (input.value || '').length;
      };
      input.addEventListener('input', update);
      update();
    });
  }


  
  function bindInputHints() {
    const studentIDInput = form.studentID;
    studentIDInput &&
      studentIDInput.addEventListener('input', () => {
        const ok = SID_PATTERN.test(studentIDInput.value.trim());
        const hint = document.getElementById('sidHint');
        hint.textContent = ok
          ? 'All good!'
          : '8 digits long (e.g. 12345678).';
      });
  }


  
  window.__turnstileToken__ = '';

  function renderTurnstile() {
    if (!SITEKEY) {
      console.warn('TURNSTILE_SITEKEY not configured.');
      return;
    }
    if (!window.turnstile) {
      setTimeout(renderTurnstile, 300);
      return;
    }
    const widget = document.getElementById('turnstileWidget');
    widget.innerHTML = '';
    window.turnstile.render(widget, {
      sitekey: SITEKEY,
      callback: (token) => (window.__turnstileToken__ = token),
      'expired-callback': () => (window.__turnstileToken__ = ''),
      'error-callback': () => (window.__turnstileToken__ = ''),
    });
  }

  function resetTurnstile() {
    try {
      if (window.turnstile) window.turnstile.reset();
    } catch (e) { /* noop */ }
    window.__turnstileToken__ = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isLocked) return;

    const clientCheck = validateClientFields(true);
    if (!clientCheck.valid) return;

    if (!signaturePad || signaturePad.isEmpty()) {
      showClientErrors(['Please provide your signature']);
      return;
    }
    signatureDataInput.value = signaturePad.toDataURL('image/png');

    const token = window.__turnstileToken__;
    if (!token) {
      enterRejectedState();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    const body = {
      ...getFieldValues(),
      signatureData: signatureDataInput.value,
      turnstileToken: token,
    };

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        enterSuccessState();
      } else {
        enterRejectedState();
      }
    } catch (err) {
      console.error('Network / server error on submit', err);
      enterRejectedState();
    } finally {
      if (!formCard.classList.contains('hidden')) {
        submitBtn.disabled = false;
        submitBtn.textContent = isLocked ? 'Submissions Closed' : 'Submit Signature';
      }
    }
  }



  function wireEvents() {
    form.addEventListener('submit', handleSubmit);
    const clearSigBtn = document.getElementById('clearSignature');
    clearSigBtn &&
      clearSigBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (signaturePad) signaturePad.clear();
        signatureDataInput.value = '';
      });
    bindCounters();
    bindInputHints();
  }

  async function boot() {
    wireEvents();
    initSignaturePad();
    renderTurnstile();
    refreshCount();
    setInterval(refreshCount, 30000);

    const now = Date.now();
    const expired = now >= DEADLINE.getTime();
    if (expired) {
      enterLockedState();
    } else {
      enterFormState(false);
    }

    bootedOnce = true;
    renderCountdown();
    setInterval(renderCountdown, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();