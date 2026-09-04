/* Feedback funnel: 5 stars -> Google Reviews, 1-4 stars -> private form emailed to the office. */

(function () {
    'use strict';

    var GOOGLE_REVIEW_URL = 'https://www.google.com/maps/place//data=!4m3!3m2!1s0x2d2dabf6cb6037b3:0x42c4cfb114791e9c!12e1?source=g.page.m.ia._&laa=nmx-review-solicitation-ia2';
    var REDIRECT_DELAY_MS = 1200;
    var ADVANCE_DELAY_MS = 450; // long enough to see the star fill and read the caption
    var MIN_FILL_TIME_MS = 3000; // anything faster than this is a bot, not a customer

    var CAPTIONS = {
        1: 'Terrible — we let you down',
        2: 'Poor — this needs fixing',
        3: 'Okay — room to improve',
        4: 'Good — almost there',
        5: 'Excellent — we nailed it!'
    };

    var PROMPTS = {
        1: 'We’re sorry — what went wrong?',
        2: 'We’re sorry — what went wrong?',
        3: 'What would have made it a 5?',
        4: 'What would have made it a 5?'
    };

    var loadedAt = Date.now();

    // --- Elements -----------------------------------------------------------
    var steps = {
        rating: document.getElementById('step-rating'),
        feedback: document.getElementById('step-feedback'),
        redirect: document.getElementById('step-redirect'),
        success: document.getElementById('step-success')
    };

    var starsWrap = document.getElementById('stars');
    var starInputs = Array.prototype.slice.call(document.querySelectorAll('.fb-stars__input'));
    var caption = document.getElementById('rating-caption');

    var backBtn = document.getElementById('feedback-back');
    var form = document.getElementById('feedback-form');
    var messageEl = document.getElementById('fb-message');
    var counter = document.getElementById('fb-counter');
    var errorEl = document.getElementById('feedback-error');
    var submitBtn = document.getElementById('feedback-submit');
    var promptTitle = document.getElementById('step-feedback-title');
    var pillStars = document.getElementById('rating-pill-stars');
    var pillLabel = document.getElementById('rating-pill-label');
    var googleLink = document.getElementById('google-link');

    var selectedRating = 0;
    var advancing = false;        // guards against a double-tap firing the route twice
    var pointerSelected = false;  // true when the change came from a tap/click, not the keyboard

    googleLink.href = GOOGLE_REVIEW_URL;

    // --- Helpers ------------------------------------------------------------

    function showStep(name) {
        Object.keys(steps).forEach(function (key) {
            steps[key].hidden = key !== name;
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function setFill(value) {
        if (value) {
            starsWrap.setAttribute('data-fill', String(value));
        } else {
            starsWrap.removeAttribute('data-fill');
        }
    }

    function starString(n) {
        return new Array(n + 1).join('★') + new Array(6 - n).join('☆');
    }

    // --- Step 1: rating -----------------------------------------------------

    // Sends the customer down one of the two paths. 5 stars goes public on Google,
    // everything else opens the private form.
    function route() {
        if (!selectedRating || advancing) return;
        advancing = true;

        window.setTimeout(function () {
            if (selectedRating === 5) {
                showStep('redirect');
                window.setTimeout(function () {
                    window.location.href = GOOGLE_REVIEW_URL;
                }, REDIRECT_DELAY_MS);
                return;
            }

            promptTitle.textContent = PROMPTS[selectedRating];
            pillStars.textContent = starString(selectedRating);
            pillLabel.textContent = selectedRating + ' out of 5';
            showStep('feedback');
            messageEl.focus({ preventScroll: true });
            advancing = false;
        }, ADVANCE_DELAY_MS);
    }

    starInputs.forEach(function (input) {
        var value = parseInt(input.value, 10);
        var label = document.querySelector('label[for="' + input.id + '"]');

        input.addEventListener('change', function () {
            selectedRating = value;
            setFill(value);
            caption.textContent = CAPTIONS[value];

            // A tap or click is a decision, so route straight away. A keyboard arrow
            // key is just browsing the options, so wait for Enter instead - otherwise
            // keyboard users get thrown to the next screen on their first keypress.
            if (pointerSelected) {
                pointerSelected = false;
                route();
            }
        });

        label.addEventListener('pointerdown', function () { pointerSelected = true; });

        // Hover preview on pointer devices only; reverts to the selection on leave.
        label.addEventListener('mouseenter', function () { setFill(value); });
        label.addEventListener('mouseleave', function () { setFill(selectedRating); });
    });

    starsWrap.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && selectedRating) {
            event.preventDefault();
            route();
        }
    });

    // --- Step 2: written feedback ------------------------------------------

    backBtn.addEventListener('click', function () {
        advancing = false;
        showStep('rating');
    });

    messageEl.addEventListener('input', function () {
        counter.textContent = messageEl.value.length + ' / ' + messageEl.maxLength;
        if (messageEl.value.trim()) hideError();
    });

    function showError(text) {
        errorEl.textContent = text;
        errorEl.hidden = false;
    }

    function hideError() {
        errorEl.hidden = true;
    }

    // If the customer taps Back after the Google redirect, the browser restores this
    // page frozen on the "redirecting..." spinner. Send them back to the start instead.
    window.addEventListener('pageshow', function (event) {
        if (event.persisted && !steps.redirect.hidden) {
            advancing = false;
            showStep('rating');
        }
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        hideError();

        var message = messageEl.value.trim();
        if (message.length < 3) {
            showError('Please tell us a little about what happened before sending.');
            messageEl.focus();
            return;
        }

        // Bot checks: hidden field must stay empty, and a real person needs a few seconds.
        var honeypot = document.getElementById('fb-website').value;
        if (honeypot || Date.now() - loadedAt < MIN_FILL_TIME_MS) {
            showStep('success'); // fail silently so bots learn nothing
            return;
        }

        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;

        fetch('/api/submit-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rating: selectedRating,
                name: document.getElementById('fb-name').value.trim(),
                contact: document.getElementById('fb-contact').value.trim(),
                message: message,
                pageUrl: window.location.href
            })
        })
            .then(function (res) {
                if (!res.ok) throw new Error('Request failed with status ' + res.status);
                return res.json();
            })
            .then(function () {
                showStep('success');
            })
            .catch(function () {
                showError('Sorry — we couldn’t send that just now. Please try again, or call us at (323) 645-2636.');
            })
            .finally(function () {
                submitBtn.classList.remove('is-loading');
                submitBtn.disabled = false;
            });
    });
})();
