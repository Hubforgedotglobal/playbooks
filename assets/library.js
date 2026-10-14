(() => {
  "use strict";
  const grid = document.querySelector("[data-library-grid]");
  const search = document.querySelector("[data-library-search]");
  const sort = document.querySelector("[data-library-sort]");
  const filters = document.querySelector("[data-library-filters]");
  if (!grid || !search || !sort || !filters) return;

  const cards = [...grid.querySelectorAll(".book")];
  const topics = new Map();
  const normalize = text => String(text || "").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
  const entries = cards.map((card, index) => {
    const ids = (card.dataset.topics || "").split(/\s+/).filter(Boolean);
    const labels = (card.dataset.topicLabels || "").split("|");
    ids.forEach((id, i) => {
      if (!topics.has(id)) topics.set(id, labels[i] || id.replace(/-/g, " "));
    });
    const title = card.dataset.title || card.querySelector("h3")?.textContent || "";
    const description = card.querySelector(".book-desc")?.textContent || "";
    return {
      card, title, topics: ids, index,
      order: Number(card.dataset.order) || index + 1,
      searchable: normalize([title, description, labels.join(" "), card.dataset.search || ""].join(" ")),
    };
  });
  const counts = [...document.querySelectorAll("[data-library-count]")];
  const empty = document.querySelector("[data-library-empty]");
  const clearButtons = [...document.querySelectorAll("[data-library-clear]")];
  const resetButtons = [...document.querySelectorAll("[data-library-reset]")];
  const sorts = new Set(["newest", "title", "oldest"]);
  let state = { query: "", topic: "all", sort: "newest" };

  function readURL() {
    const params = new URL(location.href).searchParams;
    const topic = params.get("topic") || "all";
    const selectedSort = params.get("sort") || "newest";
    state = {
      query: params.get("q") || "",
      topic: topics.has(topic) ? topic : "all",
      sort: sorts.has(selectedSort) ? selectedSort : "newest",
    };
    search.value = state.query;
    sort.value = state.sort;
  }

  function writeURL() {
    const url = new URL(location.href);
    const values = { q: state.query.trim(), topic: state.topic === "all" ? "" : state.topic,
      sort: state.sort === "newest" ? "" : state.sort };
    Object.entries(values).forEach(([name, value]) => {
      if (value) url.searchParams.set(name, value);
      else url.searchParams.delete(name);
    });
    // Keep unrelated parameters and chapter anchors intact.
    try { history.replaceState(history.state, "", url.pathname + url.search + url.hash); } catch (_) {}
  }

  const topicButtons = new Map();
  filters.replaceChildren();
  [["all", "All topics"], ...topics].forEach(([id, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "library-filter";
    button.dataset.libraryTopic = id;
    const name = document.createElement("span");
    name.textContent = label;
    const count = document.createElement("span");
    count.className = "library-filter-count";
    count.setAttribute("aria-hidden", "true");
    button.append(name, count);
    button.addEventListener("click", () => {
      state.topic = id;
      render(true);
    });
    topicButtons.set(id, { button, count, label });
    filters.append(button);
  });

  function render(updateURL = false) {
    const words = normalize(state.query).split(/\s+/).filter(Boolean);
    const matchesQuery = entry => words.every(word => entry.searchable.includes(word));
    const queryMatches = entries.filter(matchesQuery);
    const ordered = [...entries].sort((a, b) => {
      if (state.sort === "title") return a.title.localeCompare(b.title, "en", { sensitivity: "base" }) || a.index - b.index;
      return (state.sort === "oldest" ? a.order - b.order : b.order - a.order) || a.index - b.index;
    });
    // Move existing nodes, keeping ratings, notes and their event handlers intact.
    ordered.forEach(entry => grid.append(entry.card));
    let visible = 0;
    entries.forEach(entry => {
      const show = matchesQuery(entry) && (state.topic === "all" || entry.topics.includes(state.topic));
      entry.card.hidden = !show;
      if (show) visible++;
    });
    topicButtons.forEach(({ button, count, label }, id) => {
      const total = queryMatches.filter(entry => id === "all" || entry.topics.includes(id)).length;
      count.textContent = String(total);
      button.setAttribute("aria-pressed", String(state.topic === id));
      button.setAttribute("aria-label", `${label}, ${total} ${total === 1 ? "playbook" : "playbooks"}`);
    });
    counts.forEach(el => {
      el.textContent = visible === entries.length
        ? `${visible} ${visible === 1 ? "playbook" : "playbooks"}`
        : `${visible} of ${entries.length} playbooks`;
    });
    if (empty) empty.hidden = visible > 0;
    clearButtons.forEach(button => { button.hidden = !state.query; });
    resetButtons.forEach(button => {
      if (!button.closest("[data-library-empty]"))
        button.hidden = !state.query && state.topic === "all" && state.sort === "newest";
    });
    if (updateURL) writeURL();
  }

  function searchChanged() {
    state.query = search.value;
    render(true);
  }
  search.addEventListener("input", searchChanged);
  search.addEventListener("search", searchChanged);
  sort.addEventListener("change", () => {
    state.sort = sorts.has(sort.value) ? sort.value : "newest";
    render(true);
  });
  clearButtons.forEach(button => button.addEventListener("click", () => {
    state.query = "";
    search.value = "";
    render(true);
    search.focus();
  }));
  resetButtons.forEach(button => {
    button.addEventListener("click", () => {
      state = { query: "", topic: "all", sort: "newest" };
      search.value = "";
      sort.value = state.sort;
      render(true);
      search.focus();
    });
  });
  addEventListener("popstate", () => { readURL(); render(); });
  readURL();
  render();
  document.querySelectorAll("[data-library-tools]").forEach(el => { el.hidden = false; });

  function revealAnchor(hash) {
    let id;
    try { id = decodeURIComponent(hash.replace(/^#/, "")); } catch (_) { return; }
    let target = document.getElementById(id);
    while (target) {
      if (target.tagName === "DETAILS") target.open = true;
      target = target.parentElement;
    }
  }
  document.addEventListener("click", event => {
    const link = event.target.closest('a[href^="#"]');
    if (link) revealAnchor(link.getAttribute("href"));
  });
  addEventListener("hashchange", () => revealAnchor(location.hash));
  revealAnchor(location.hash);

  const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const revealElements = [...document.querySelectorAll("[data-library-reveal]")];
  let observer;
  function configureMotion() {
    observer?.disconnect();
    if (!motion || motion.matches || typeof IntersectionObserver !== "function") {
      document.documentElement.classList.remove("library-motion-ready");
      revealElements.forEach(el => el.classList.add("is-visible"));
      return;
    }
    document.documentElement.classList.add("library-motion-ready");
    observer = new IntersectionObserver(records => {
      records.forEach(record => {
        if (!record.isIntersecting) return;
        record.target.classList.add("is-visible");
        observer.unobserve(record.target);
      });
    // A percentage threshold may never be reached by a long catalog section.
    }, { threshold: 0, rootMargin: "0px 0px 36px 0px" });
    revealElements.forEach(el => observer.observe(el));
  }
  configureMotion();
  motion?.addEventListener?.("change", configureMotion);
  addEventListener("pagehide", () => observer?.disconnect());
  addEventListener("pageshow", event => { if (event.persisted) configureMotion(); });
})();
