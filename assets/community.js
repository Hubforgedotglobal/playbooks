(() => {
  "use strict";
  const API_SETTING = window.PLAYBOOK_COMMUNITY_API;
  const libraryHost = location.hostname === "playbooks.hubforgeglobal.com";
  const apiBase = typeof API_SETTING === "string" && API_SETTING.trim()
    ? API_SETTING.trim().replace(/\/+$/, "")
    : (!libraryHost ? location.origin : "");
  const slugs = ["designing-dashboards", "claude-dashboards"];
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const slug = document.body.dataset.communitySlug || ($("[data-community-slug]") || {}).dataset?.communitySlug || "";
  const TOKEN_KEY = "hf-community-token";
  const state = { data:null, voted:new Set(), myRatings:new Map() };
  let memoryToken = "", sessionPromise = null;
  const endpoint = path => `${apiBase}/api/community${path}`;

  function status(el, message, error=false) {
    if (!el) return;
    el.textContent = message;
    el.setAttribute("role", error ? "alert" : "status");
  }
  function setCommunityAvailability(available, message) {
    $$("[data-community-action]").forEach(control => { control.disabled = !available; });
    $$("[data-community-status]").forEach(el => status(el, message, !available));
  }
  async function responseError(response) {
    let detail = "";
    try { detail = (await response.json()).error || ""; } catch (_) {}
    return detail || (response.status === 503 ? "The community service is temporarily unavailable." : `The request could not be completed (${response.status}).`);
  }
  async function request(path, options={}, retryAuth=true) {
    if (!apiBase) throw new Error("Community service is not configured on this host.");
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined) headers.set("Content-Type","application/json");
    if (options.authorized) {
      const token = await getToken(Boolean(options.keepalive));
      headers.set("Authorization",`Bearer ${token}`);
    }
    const init = { ...options, headers };
    delete init.authorized;
    try {
      const response = await fetch(endpoint(path),init);
      if (response.status === 401 && options.authorized && retryAuth) {
        memoryToken = "";
        try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
        return request(path,options,false);
      }
      if (!response.ok) throw new Error(await responseError(response));
      return response.status === 204 ? {} : response.json();
    } catch (error) {
      if (error instanceof TypeError) throw new Error("Could not reach the community service. Check your connection and try again.");
      throw error;
    }
  }
  async function getToken(keepalive=false) {
    let token = memoryToken;
    try { token = localStorage.getItem(TOKEN_KEY) || memoryToken; } catch (_) {}
    if (token) return token;
    if (!sessionPromise) {
      sessionPromise = request("/session",{ method:"POST", body:"{}",keepalive }).then(result => {
        if (!result.token) throw new Error("The community service did not provide a browser session.");
        memoryToken = result.token;
        try { localStorage.setItem(TOKEN_KEY,result.token); } catch (_) {}
        return result.token;
      }).finally(() => { sessionPromise = null; });
    }
    return sessionPromise;
  }
  function renderStats() {
    if (!state.data || !Array.isArray(state.data.playbooks)) return;
    state.data.playbooks.forEach(item => {
      if (!slugs.includes(item.slug)) return;
      const slot = $(`[data-hf-stats="${item.slug}"]`);
      if (!slot) return;
      slot.replaceChildren();
      if (Number.isFinite(item.views)) {
        const views = document.createElement("span");
        views.textContent = `${new Intl.NumberFormat().format(item.views)} views`;
        slot.append(views);
      }
      if (Number.isFinite(item.ratingAverage) && Number.isFinite(item.ratingCount) && item.ratingCount > 0) {
        const rating = document.createElement("span");
        rating.textContent = `★ ${item.ratingAverage.toFixed(1)} · ${item.ratingCount} ${item.ratingCount === 1 ? "rating" : "ratings"}`;
        slot.append(rating);
      }
    });
  }
  function renderTopics() {
    const list = $("[data-hf-topics]");
    if (!list) return;
    list.replaceChildren();
    const topics = state.data && Array.isArray(state.data.topics) ? state.data.topics : [];
    if (!topics.length) {
      const note = document.createElement("p");
      note.className = "hf-status";
      note.textContent = "No next-topic ideas are open for voting right now.";
      list.append(note);
      return;
    }
    topics.forEach(topic => {
      const row = document.createElement("div");
      row.className = "hf-topic";
      const title = document.createElement("span");
      title.className = "hf-topic-title";
      title.textContent = topic.title;
      if (topic.description) {
        const description = document.createElement("span");
        description.className = "hf-topic-description";
        description.textContent = topic.description;
        title.append(description);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hf-topic-vote";
      button.dataset.voteTopic = topic.id;
      const voted = state.voted.has(String(topic.id));
      button.setAttribute("aria-pressed",String(voted));
      button.disabled = !apiBase;
      button.innerHTML = `<span>${voted ? "Saved" : "Vote"}</span><span class="hf-count">${Number.isFinite(topic.votes) ? topic.votes : 0}</span>`;
      button.addEventListener("click",() => vote(topic.id,button));
      row.append(title,button);
      list.append(row);
    });
  }
  function renderReviews() {
    const container = $("[data-hf-reviews]");
    if (!container) return;
    container.replaceChildren();
    const reviews = state.data && Array.isArray(state.data.reviews)
      ? state.data.reviews.filter(review => review.playbook === slug && review.comment && review.comment.trim())
      : [];
    if (!reviews.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    const heading = document.createElement("h3");
    heading.textContent = "Reader notes";
    container.append(heading);
    reviews.forEach(review => {
      const article = document.createElement("article");
      article.className = "hf-review";
      const rating = document.createElement("p");
      rating.className = "hf-review-rating";
      rating.textContent = `★ ${review.rating} out of 5`;
      const text = document.createElement("p");
      text.textContent = review.comment;
      article.append(rating,text);
      container.append(article);
    });
  }
  async function loadMe() {
    let token = memoryToken;
    try { token = localStorage.getItem(TOKEN_KEY) || memoryToken; } catch (_) {}
    if (!token || !apiBase) return;
    try {
      const mine = await request("/me",{ authorized:true });
      if (Array.isArray(mine.votes)) state.voted = new Set(mine.votes.map(String));
      if (Array.isArray(mine.ratings)) state.myRatings = new Map(mine.ratings.map(item => [item.playbook,item]));
      renderTopics();
      restoreRating();
    } catch (_) { /* GET community remains usable if a saved session has expired. */ }
  }
  function restoreRating() {
    $$("[data-hf-rating-form]").forEach(form => {
    const mine = state.myRatings.get(form.dataset.ratingPlaybook || slug);
    if (!mine) return;
    const ratingInput = $("input[name=rating]",form);
    if (ratingInput) ratingInput.value = String(mine.rating);
    const comment = $("textarea[name=comment]",form);
    if (comment) comment.value = mine.comment || "";
    setStars(Number(mine.rating),form);
    const button = $(".hf-submit",form);
    if (button) button.textContent = "Update my rating";
    });
  }
  function setStars(rating,form) {
    $$(".hf-star",form).forEach(button => {
      button.setAttribute("aria-pressed",String(Number(button.dataset.rating) <= rating));
      button.setAttribute("aria-label",`${button.dataset.rating} ${button.dataset.rating === "1" ? "star" : "stars"}`);
    });
    const hidden = $("input[name=rating]",form);
    if (hidden) hidden.value = String(rating);
  }
  async function refreshCommunity() {
    if (!apiBase) {
      setCommunityAvailability(false,"Community features are not ready on this host. You can still read and download the playbooks.");
      return;
    }
    setCommunityAvailability(false,"Loading community features…");
    try {
      state.data = await request("");
      renderStats();
      renderTopics();
      renderReviews();
      await loadMe();
      setCommunityAvailability(true,"");
    } catch (error) {
      setCommunityAvailability(false,error.message);
      $$("[data-hf-topics]").forEach(list => {
        const retry = document.createElement("button");
        retry.type = "button"; retry.className = "hf-submit"; retry.textContent = "Retry loading";
        retry.addEventListener("click",refreshCommunity);
        list.replaceChildren(retry);
      });
    }
  }
  async function vote(topicId,button) {
    if (button.disabled || button.getAttribute("aria-pressed") === "true") return;
    const votingSection = $("[data-hf-topics]")?.closest(".hf-community") || document;
    const message = $("[data-community-status]",votingSection);
    button.disabled = true;
    try {
      const result = await request("/votes",{ method:"POST",authorized:true,body:JSON.stringify({topic:topicId}) });
      if (result.voted) {
        state.voted.add(String(topicId));
        button.setAttribute("aria-pressed","true");
        $("span:first-child",button).textContent = "Saved";
        $(".hf-count",button).textContent = String(result.votes);
        status(message,"Your vote is saved.");
      } else {
        state.voted.add(String(topicId));
        button.setAttribute("aria-pressed","true");
        $("span:first-child",button).textContent = "Saved";
        $(".hf-count",button).textContent = String(result.votes);
      }
    } catch (error) {
      $("span:first-child",button).textContent = "Retry vote";
      status(message,error.message,true);
    } finally { button.disabled = false; }
  }
  function bindSuggestion() {
    const form = $("[data-hf-suggestion-form]");
    if (!form) return;
    form.addEventListener("submit",async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = $(".hf-submit",form), message = $("[data-community-status]",form);
      button.disabled = true; button.textContent = "Sending…";
      status(message,"Sending your suggestion.");
      try {
        await request("/suggestions",{method:"POST",authorized:true,body:JSON.stringify({
          title:$("input[name=title]",form).value.trim(),
          goal:$("textarea[name=goal]",form).value.trim(),
          website:$("input[name=website]",form).value
        })});
        form.reset();
        button.textContent = "Suggestion received";
        status(message,"Thank you. Your suggestion was received privately.");
      } catch (error) {
        button.textContent = "Retry suggestion";
        status(message,error.message,true);
      } finally { button.disabled = !apiBase; }
    });
  }
  function bindRating() {
    $$("[data-hf-rating-form]").forEach(form => {
    const ratedSlug = form.dataset.ratingPlaybook || slug;
    $$(".hf-star",form).forEach(button => {
      button.addEventListener("click",() => setStars(Number(button.dataset.rating),form));
      button.addEventListener("keydown",event => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          const next = Math.max(1,Math.min(5,Number($("input[name=rating]",form).value) + (event.key === "ArrowRight" ? 1 : -1)));
          setStars(next,form); $(`[data-rating="${next}"]`,form).focus();
        }
      });
    });
    form.addEventListener("submit",async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const rating = Number($("input[name=rating]",form).value);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        status($("[data-community-status]",form),"Choose a rating from 1 to 5.",true); return;
      }
      const button = $(".hf-submit",form), message = $("[data-community-status]",form);
      button.disabled = true; button.textContent = "Saving…";
      status(message,"Saving your rating.");
      try {
        await request("/ratings",{method:"POST",authorized:true,body:JSON.stringify({
          playbook:ratedSlug,rating,comment:$("textarea[name=comment]",form).value.trim(),
          website:$("input[name=website]",form).value
        })});
        state.myRatings.set(ratedSlug,{ playbook:ratedSlug,rating,comment:$("textarea[name=comment]",form).value.trim() });
        button.textContent = "Update my rating";
        status(message,"Your rating was saved. You can update it any time.");
        // Refresh live averages without resetting the writer's form or other cards.
        request("").then(data => { state.data=data; renderStats(); }).catch(() => {});
      } catch (error) {
        button.textContent = state.myRatings.has(ratedSlug) ? "Retry rating update" : "Retry rating";
        status(message,error.message,true);
      } finally { button.disabled = !apiBase; }
    });
    });
  }
  function trackEvents() {
    if (!slug || !slugs.includes(slug) || !apiBase) return;
    let elapsed = 0, last = 0, done = false, frame = 0;
    const tick = now => {
      frame = 0;
      if (document.visibilityState !== "visible" || done) return;
      if (last) elapsed += now - last;
      last = now;
      if (elapsed >= 8000) {
        done = true;
        request("/events",{method:"POST",authorized:true,body:JSON.stringify({playbook:slug,kind:"view"}),keepalive:true})
          .catch(() => {});
      } else frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      if (document.visibilityState === "visible") {
        last = 0;
        if (!frame && !done) frame = requestAnimationFrame(tick);
      } else {
        if (frame) cancelAnimationFrame(frame);
        frame = 0; last = 0;
      }
    };
    document.addEventListener("visibilitychange",visibility);
    visibility();
  }
  function trackDownloads() {
    document.addEventListener("click",event => {
      const link = event.target.closest("a[href]");
      if (!link) return;
      const url = new URL(link.href,location.href);
      const match = url.pathname.match(/\/(designing-dashboards|claude-dashboards)\/playbook\.pdf$/);
      if (!match || !slugs.includes(match[1]) || !apiBase) return;
      request("/events",{method:"POST",authorized:true,body:JSON.stringify({playbook:match[1],kind:"download"}),keepalive:true}).catch(() => {});
    },true);
  }
  function installStatsSlots() {
    $$(".book").forEach(card => {
      const title = $(".book-meta",card);
      const slugGuess = $("a[href*='designing-dashboards/']",card) ? "designing-dashboards" : "claude-dashboards";
      if (!title || $(`[data-hf-stats="${slugGuess}"]`,card)) return;
      const slot = document.createElement("p");
      slot.className = "hf-shelf-stats";
      slot.dataset.hfStats = slugGuess;
      slot.setAttribute("aria-label","Live reader and rating information");
      title.after(slot);
    });
  }
  function addRetryActions() {
    $$("[data-community-retry]").forEach(button => button.addEventListener("click",refreshCommunity));
  }

  installStatsSlots();
  bindSuggestion();
  bindRating();
  addRetryActions();
  trackEvents();
  trackDownloads();
  refreshCommunity();
})();
