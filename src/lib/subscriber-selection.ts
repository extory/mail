import type { Subscriber } from "./types";

export function filterSubscribers(subscribers: Subscriber[], search: string, groupId = ""): Subscriber[] {
  const query = search.trim().toLowerCase();
  return subscribers.filter(subscriber => {
    const matchesGroup = !groupId || (groupId === "0"
      ? subscriber.groups.length === 0
      : subscriber.groups.some(group => group.id === Number(groupId)));
    return matchesGroup && (!query || subscriber.email.toLowerCase().includes(query) ||
      (subscriber.name || "").toLowerCase().includes(query));
  });
}

export function selectedVisibleIds(subscribers: Subscriber[], selected: Set<number>): number[] {
  return subscribers.filter(subscriber => selected.has(subscriber.id)).map(subscriber => subscriber.id);
}
