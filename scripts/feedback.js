/* Feedback funnel: 5 stars -> Google Reviews, 1-4 stars -> private form emailed to the office. */

(function () {
    'use strict';

    var GOOGLE_REVIEW_URL = 'https://g.page/r/CZweeRSxz8RCEBM/review';
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

    // Details Make.com puts in the link (?n=first+name&c=email) so the customer doesn't
    // retype them and the office knows which move the feedback belongs to.
    // Read 'c' off the raw query string rather than through URLSearchParams, which
    // treats a literal '+' as a space and would quietly turn jane+moving@gmail.com
    // into 'jane moving@gmail.com'. This way the address survives whether or not
    // the sender percent-encoded the plus. 'n' is a first name, where '+' really
    // does mean a space, so that one keeps the normal behaviour.
    function rawParam(key) {
        var match = new RegExp('[?&]' + key + '=([^&]*)').exec(window.location.search);
        if (!match) return '';
        try {
            return decodeURIComponent(match[1]);
        } catch (e) {
            return ''; // malformed escape - better to prefill nothing than garbage
        }
    }

    var linkParams = new URLSearchParams(window.location.search);
    var fromLink = {
        name: (linkParams.get('n') || '').trim().slice(0, 80),
        contact: rawParam('c').trim().slice(0, 120)
    };

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
    var nameEl = document.getElementById('fb-name');
    var contactEl = document.getElementById('fb-contact');
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

    if (fromLink.name) nameEl.value = fromLink.name;
    if (fromLink.contact) contactEl.value = fromLink.contact;

    // Drop the query string once it's been read, so the customer's email isn't sitting
    // in the address bar and can't ride along to Google in the referrer header.
    if (window.history.replaceState && window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
    }

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

    // 5-star customers never submit the form - they leave for Google - so the office
    // would never hear about them. Ping the server before the redirect instead.
    // keepalive lets the request finish even though the page is unloading.
    function trackRedirect() {
        if (document.getElementById('fb-website').value) return; // bot filled the honeypot

        try {
            window.fetch('/api/submit-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                body: JSON.stringify({
                    kind: 'redirect',
                    rating: 5,
                    linkName: fromLink.name,
                    linkContact: fromLink.contact
                })
            })['catch'](function () { /* never let this block the redirect */ });
        } catch (e) { /* same */ }
    }

    // Sends the customer down one of the two paths. 5 stars goes public on Google,
    // everything else opens the private form.
    function route() {
        if (!selectedRating || advancing) return;
        advancing = true;

        window.setTimeout(function () {
            if (selectedRating === 5) {
                trackRedirect();
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
                kind: 'feedback',
                rating: selectedRating,
                name: nameEl.value.trim(),
                contact: contactEl.value.trim(),
                message: message,
                linkName: fromLink.name,
                linkContact: fromLink.contact
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
