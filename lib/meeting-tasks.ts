export interface MeetingTaskInput {
  id?: string;
  title: string;
  completed: boolean;
  sortOrder: number;
}

export function parseMultilineTasks(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function appendMultilineTasks(
  existing: MeetingTaskInput[],
  text: string
): MeetingTaskInput[] {
  const titles = parseMultilineTasks(text);
  if (titles.length === 0) return existing;

  const startOrder = existing.length;
  const newTasks = titles.map((title, index) => ({
    title,
    completed: false,
    sortOrder: startOrder + index,
  }));

  return [...existing, ...newTasks];
}

export function reindexMeetingTasks(tasks: MeetingTaskInput[]): MeetingTaskInput[] {
  return tasks.map((task, index) => ({ ...task, sortOrder: index }));
}

export interface MeetingDecisionInput {
  id?: string;
  title: string;
  sortOrder: number;
}

export function appendMultilineDecisions(
  existing: MeetingDecisionInput[],
  text: string
): MeetingDecisionInput[] {
  const titles = parseMultilineTasks(text);
  if (titles.length === 0) return existing;

  const startOrder = existing.length;
  const newItems = titles.map((title, index) => ({
    title,
    sortOrder: startOrder + index,
  }));

  return [...existing, ...newItems];
}

export function reindexMeetingDecisions(decisions: MeetingDecisionInput[]): MeetingDecisionInput[] {
  return decisions.map((item, index) => ({ ...item, sortOrder: index }));
}
