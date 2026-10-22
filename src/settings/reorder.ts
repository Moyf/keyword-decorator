import { Keymap, Scope } from "obsidian";

/** Pointer sorting uses the list's own document, including standalone Settings. */
export function attachReorder(list: HTMLElement, enabled: boolean, commit: (ids: string[]) => void, keymap: Keymap): () => void {
  const doc = list.ownerDocument;
  const win = doc.defaultView!;
  let row: HTMLElement | null = null;
  let pointer = -1, startY = 0, lastY = 0, dragging = false, frame = 0;
  let original: HTMLElement[] = [];
  let cancelScope: Scope | null = null;
  const rows = () => Array.from(list.querySelectorAll<HTMLElement>(".kd-rule"));
  function position(y: number) {
    if (!row) return;
    const before = rows().find(candidate => candidate !== row && y < candidate.getBoundingClientRect().top + candidate.getBoundingClientRect().height / 2);
    if (row.nextElementSibling !== (before || null)) list.insertBefore(row, before || null);
  }
  function scroll() {
    if (!row || !dragging) return;
    const rect = list.getBoundingClientRect();
    const speed = lastY < rect.top + 30 ? -10 : lastY > rect.bottom - 30 ? 10 : 0;
    if (speed) { list.scrollTop += speed; position(lastY); }
    frame = win.requestAnimationFrame(scroll);
  }
  function move(event: PointerEvent) {
    if (!row || event.pointerId !== pointer) return;
    lastY = event.clientY;
    if (!dragging && Math.abs(lastY - startY) < 4) return;
    event.preventDefault();
    if (!dragging) {
      dragging = true; row.addClass("is-dragging"); list.addClass("is-sorting");
      frame = win.requestAnimationFrame(scroll);
    }
    position(lastY);
  }
  function finish(cancel: boolean) {
    if (!row) return;
    const wasDragging = dragging;
    if (cancel) for (const element of original) list.appendChild(element);
    row.removeClass("is-dragging"); list.removeClass("is-sorting");
    if (list.hasPointerCapture(pointer)) list.releasePointerCapture(pointer);
    win.cancelAnimationFrame(frame);
    const order = rows().map(element => element.dataset.id!);
    row = null; pointer = -1; dragging = false;
    doc.removeEventListener("pointermove", move);
    doc.removeEventListener("pointerup", up);
    doc.removeEventListener("pointercancel", cancelPointer);
    if (cancelScope) keymap.popScope(cancelScope);
    cancelScope = null;
    win.removeEventListener("blur", cancelWindow);
    if (wasDragging && !cancel && order.some((id, index) => id !== original[index]?.dataset.id)) commit(order);
  }
  function up(event: PointerEvent) { if (event.pointerId === pointer) finish(false); }
  function cancelPointer(event: PointerEvent) { if (event.pointerId === pointer) finish(true); }
  function cancelWindow() { finish(true); }
  function down(event: PointerEvent) {
    if (!enabled || event.button !== 0 || !event.isPrimary || row) return;
    const target = event.target as Node | null;
    if (!target || target.nodeType !== 1) return;
    const handle = (target as Element).closest(".kd-grip");
    if (!handle) return;
    row = handle.closest<HTMLElement>(".kd-rule");
    if (!row) return;
    event.preventDefault(); original = rows(); pointer = event.pointerId; startY = lastY = event.clientY;
    list.setPointerCapture(pointer);
    doc.addEventListener("pointermove", move, { passive: false });
    doc.addEventListener("pointerup", up);
    doc.addEventListener("pointercancel", cancelPointer);
    // Settings owns an Escape binding; a temporary host scope takes precedence.
    cancelScope = new Scope();
    cancelScope.register([], "Escape", event => {
      event.preventDefault(); event.stopPropagation(); finish(true); return false;
    });
    keymap.pushScope(cancelScope);
    win.addEventListener("blur", cancelWindow);
  }
  list.addEventListener("pointerdown", down);
  return () => { finish(true); list.removeEventListener("pointerdown", down); };
}

export type GroupedReorderAction =
  | { type: "rule"; id: string; ids?: string[]; groupId?: string; beforeId?: string }
  | { type: "group"; id: string; beforeGroupId?: string };

/** Pointer sorting for grouped rule lists. The DOM is only used to calculate a drop; it is never reordered here. */
export function attachGroupedReorder(list: HTMLElement, enabled: boolean, commit: (action: GroupedReorderAction) => void, keymap: Keymap, selectedIds: (id: string) => string[] = id => [id]): () => void {
  const doc = list.ownerDocument;
  if (!doc.defaultView) return () => undefined;
  const win = doc.defaultView;

  type Drag = { kind: "rule" | "group"; el: HTMLElement; id: string; ids: string[]; elements: HTMLElement[] };
  let drag: Drag | null = null;
  let pointer = -1;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let dragging = false;
  let frame = 0;
  let action: GroupedReorderAction | null = null;
  let marked: HTMLElement[] = [];
  let cancelScope: Scope | null = null;
  let disposed = false;

  const groups = () => Array.from(list.querySelectorAll<HTMLElement>(":scope > .kd-group"));
  const namedGroups = () => groups().filter(group => (group.dataset.groupId ?? "") !== "");
  const rowsIn = (group: HTMLElement) => Array.from(group.querySelectorAll<HTMLElement>(":scope > .kd-group-items > .kd-rule"));
  const groupId = (group?: HTMLElement) => group?.dataset.groupId || undefined;

  function clearMarks() {
    for (const el of marked) el.removeClass("kd-drop-before", "kd-drop-after", "kd-drop-inside");
    marked = [];
    action = null;
  }

  function mark(el: HTMLElement, cls: "kd-drop-before" | "kd-drop-after" | "kd-drop-inside", next: GroupedReorderAction) {
    el.addClass(cls);
    marked.push(el);
    action = next;
  }

  function updateDrop(x: number, y: number) {
    if (!drag) return;
    clearMarks();
    const point = doc.elementFromPoint(x, y);
    if (!point || !list.contains(point)) return;

    if (drag.kind === "rule") {
      const targetRow = point.closest<HTMLElement>(".kd-rule");
      if (targetRow && drag.elements.includes(targetRow)) return;
      if (targetRow && list.contains(targetRow)) {
        const targetGroup = targetRow.closest<HTMLElement>(".kd-group");
        if (!targetGroup) return;
        const targetRows = rowsIn(targetGroup).filter(row => !drag!.elements.includes(row));
        const index = targetRows.indexOf(targetRow);
        const before = y < targetRow.getBoundingClientRect().top + targetRow.getBoundingClientRect().height / 2;
        const beforeId = before ? targetRow.dataset.id : targetRows[index + 1]?.dataset.id;
        mark(targetRow, before ? "kd-drop-before" : "kd-drop-after", {
          type: "rule", id: drag.id, ids: drag.ids, groupId: groupId(targetGroup), beforeId,
        });
        return;
      }

      const targetGroup = point.closest<HTMLElement>(".kd-group");
      if (targetGroup && list.contains(targetGroup)) {
        const items = targetGroup.querySelector<HTMLElement>(":scope > .kd-group-items");
        if (items && (point.closest(".kd-group-header") || items.contains(point))) {
          mark(targetGroup.querySelector<HTMLElement>(":scope > .kd-group-header") ?? items, "kd-drop-inside", { type: "rule", id: drag.id, ids: drag.ids, groupId: groupId(targetGroup) });
        }
      }
      return;
    }

    const targetGroup = point.closest<HTMLElement>(".kd-group");
    if (targetGroup && targetGroup !== drag.el && namedGroups().includes(targetGroup)) {
      const header = targetGroup.querySelector<HTMLElement>(":scope > .kd-group-header");
      if (!header) return;
      // A group handle reorders blocks only when hovering another group header.
      if (!header.contains(point)) return;
      const rest = namedGroups().filter(group => group !== drag!.el);
      const index = rest.indexOf(targetGroup);
      const before = y < header.getBoundingClientRect().top + header.getBoundingClientRect().height / 2;
      const beforeGroupId = before ? groupId(targetGroup) : groupId(rest[index + 1]);
      mark(targetGroup, before ? "kd-drop-before" : "kd-drop-after", { type: "group", id: drag.id, beforeGroupId });
    }
  }

  function scroll() {
    if (!drag || !dragging) return;
    const rect = list.getBoundingClientRect();
    const speed = lastY < rect.top + 30 ? -10 : lastY > rect.bottom - 30 ? 10 : 0;
    if (speed) {
      list.scrollTop += speed;
      updateDrop(lastX, lastY);
    }
    frame = win.requestAnimationFrame(scroll);
  }

  function finish(cancel: boolean) {
    if (!drag) return;
    const completedAction = !cancel && dragging ? action : null;
    const dragged = drag.elements;
    const activePointer = pointer;
    drag = null; pointer = -1; dragging = false;
    clearMarks();
    for (const el of dragged) el.removeClass("is-dragging");
    list.removeClass("is-sorting");
    if (list.hasPointerCapture(activePointer)) list.releasePointerCapture(activePointer);
    win.cancelAnimationFrame(frame);
    doc.removeEventListener("pointermove", move, true);
    doc.removeEventListener("pointerup", up, true);
    doc.removeEventListener("pointercancel", cancelPointer, true);
    list.removeEventListener("lostpointercapture", cancelPointer);
    win.removeEventListener("blur", cancelWindow);
    if (cancelScope) keymap.popScope(cancelScope);
    cancelScope = null;
    drag = null;
    pointer = -1;
    dragging = false;
    if (completedAction) commit(completedAction);
  }

  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== pointer) return;
    if (event.buttons === 0) { finish(true); return; }
    lastX = event.clientX;
    lastY = event.clientY;
    if (!dragging && Math.hypot(lastX - startX, lastY - startY) < 4) return;
    event.preventDefault();
    if (!dragging) {
      dragging = true;
      for (const el of drag.elements) el.addClass("is-dragging");
      list.addClass("is-sorting");
      frame = win.requestAnimationFrame(scroll);
    }
    updateDrop(lastX, lastY);
  }

  function up(event: PointerEvent) {
    if (!drag || event.pointerId !== pointer) return;
    lastX = event.clientX;
    lastY = event.clientY;
    if (dragging) updateDrop(lastX, lastY);
    finish(false);
  }

  function cancelPointer(event: PointerEvent) {
    if (drag && event.pointerId === pointer) finish(true);
  }

  function cancelWindow() { finish(true); }

  function down(event: PointerEvent) {
    if (disposed || !enabled || event.button !== 0 || !event.isPrimary) return;
    // A new press must also recover a drag whose release was lost.
    if (drag) finish(true);
    // Adopted nodes retain their original window prototype in standalone Settings.
    const target = event.target as Node | null;
    if (!target || target.nodeType !== 1) return;
    const handle = (target as Element).closest(".kd-grip, .kd-group-grip");
    if (!handle || !list.contains(handle)) return;

    const row = handle.closest<HTMLElement>(".kd-rule");
    const group = handle.closest<HTMLElement>(".kd-group");
    if (row) {
      const id = row.dataset.id ?? "", ids = selectedIds(id);
      const elements = Array.from(list.querySelectorAll<HTMLElement>(".kd-rule")).filter(el => ids.includes(el.dataset.id ?? ""));
      drag = { kind: "rule", el: row, id, ids, elements };
    } else if (group && handle.matches(".kd-group-grip") && groupId(group)) {
      drag = { kind: "group", el: group, id: groupId(group)!, ids: [], elements: [group] };
    } else return;

    event.preventDefault();
    pointer = event.pointerId;
    startX = lastX = event.clientX;
    startY = lastY = event.clientY;
    try { list.setPointerCapture(pointer); } catch {
      // Document capture listeners still track the drag if capture is unavailable.
    }
    doc.addEventListener("pointermove", move, { passive: false, capture: true });
    doc.addEventListener("pointerup", up, true);
    doc.addEventListener("pointercancel", cancelPointer, true);
    list.addEventListener("lostpointercapture", cancelPointer);
    cancelScope = new Scope();
    cancelScope.register([], "Escape", keyboardEvent => {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      finish(true);
      return false;
    });
    keymap.pushScope(cancelScope);
    win.addEventListener("blur", cancelWindow);
  }

  list.addEventListener("pointerdown", down);
  return () => {
    if (disposed) return;
    disposed = true;
    finish(true);
    list.removeEventListener("pointerdown", down);
  };
}
