/**
 * Synchronize the visible grouped topics with the existing spaced-repetition state.
 *
 * A grouped topic can declare legacy titles in `aliases`. Their records are retained
 * for rollback/audit, marked as merged, and folded into the new canonical topic once.
 * The most urgent legacy record wins so a refactor can never postpone a review.
 */
export function syncTrackedTopics(state, toggles, today) {
  let added = 0;
  let migrated = 0;

  state.items ||= {};
  for (const raw of toggles || []) {
    const title = typeof raw?.title === "string" ? raw.title.trim() : "";
    if (!title) continue;

    const section = typeof raw.section === "string" ? raw.section.trim() : "";
    const aliases = [...new Set(Array.isArray(raw.aliases) ? raw.aliases : [])]
      .map((alias) => (typeof alias === "string" ? alias.trim() : ""))
      .filter((alias) => alias && alias !== title);
    // An alias may only belong to one visible topic. This prevents a legacy key
    // from being counted twice when an earlier grouping crossed today's boundaries.
    const freshAliases = aliases.filter((alias) => {
      const item = state.items[alias];
      return item && !item.mergedInto;
    });
    const entries = [
      { key: title, item: state.items[title] },
      ...freshAliases.map((key) => ({ key, item: state.items[key] })),
    ].filter(({ item }) => item);
    const reviewedAggregate = ({ item }) => {
      if (!Array.isArray(item.migratedFrom) || !item.migratedAt) return true;
      return !!item.last && item.last >= item.migratedAt.slice(0, 10);
    };
    const authoritativeAggregates = entries.filter(reviewedAggregate);
    const superseded = new Set(authoritativeAggregates.flatMap(({ item }) => item.migratedFrom || []));
    let candidates = authoritativeAggregates
      .filter(({ key, item }) => !Array.isArray(item.migratedFrom) || !superseded.has(key))
      .filter(({ key }) => !superseded.has(key))
      .map(({ item }) => item);
    // A historical aggregate that was never reviewed after its migration is only
    // an audit record. If it is the sole record, retain it rather than creating New.
    if (!candidates.length) candidates = entries.map(({ item }) => item);

    if (!candidates.length) {
      state.items[title] = {
        section,
        status: "🆕 Mới",
        interval: 0,
        last: null,
        next: today,
        due: false,
      };
      added++;
    } else if (!state.items[title] || freshAliases.length) {
      const chosen = candidates.reduce((best, item) => {
        const bestNext = best.next || "9999-99-99";
        const itemNext = item.next || "9999-99-99";
        if (itemNext !== bestNext) return itemNext < bestNext ? item : best;
        const bestInterval = Number(best.interval) || 0;
        const itemInterval = Number(item.interval) || 0;
        if (itemInterval !== bestInterval) return itemInterval < bestInterval ? item : best;
        return (item.last || "") > (best.last || "") ? item : best;
      });
      const { mergedInto: _ignored, ...preserved } = chosen;
      state.items[title] = {
        ...preserved,
        section,
        due: false,
        migratedFrom: [...new Set([...(preserved.migratedFrom || []), ...freshAliases])],
        migratedAt: new Date().toISOString(),
      };
    } else if (section) {
      state.items[title].section = section;
    }

    for (const alias of freshAliases) {
      state.items[alias].mergedInto = title;
      state.items[alias].due = false;
      migrated++;
    }
  }

  return { added, migrated };
}

export function computeActiveDue(state, today) {
  let due = 0;
  for (const item of Object.values(state.items || {})) {
    if (item.mergedInto) {
      item.due = false;
      continue;
    }
    item.due = !!item.next && item.next <= today;
    if (item.due) due++;
  }
  return due;
}
