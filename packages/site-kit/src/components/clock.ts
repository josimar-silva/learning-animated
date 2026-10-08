// Steps can start between whole seconds, so the tenth stays in the label.
export function clock(seconds: number): string {
  const tenths = Math.round(seconds * 10);
  const minutes = Math.floor(tenths / 600);
  const secs = String(Math.floor(tenths / 10) % 60).padStart(2, '0');
  const tenth = tenths % 10;
  return tenth === 0 ? `${minutes}:${secs}` : `${minutes}:${secs}.${tenth}`;
}
