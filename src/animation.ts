import { clamp, type Diagram, type FieldElement } from './model';

export const MAX_KEYFRAMES = 100;
export const DEFAULT_DURATION_MS = 1000;

export function canAnimate(element: FieldElement) {
  return element.kind === 'player' || element.kind === 'ball';
}

export function buildMoments(diagram: Diagram) {
  let elapsed = 0;
  let elements = diagram.elements;
  return [{ at: 0, elements }, ...diagram.keyframes.map(frame => {
    elapsed += frame.durationMs;
    elements = elements.map(item => canAnimate(item) && frame.positions[item.id]
      ? { ...item, position: frame.positions[item.id] }
      : item);
    return { at: elapsed, elements };
  })];
}

export function sampleMoments(moments: ReturnType<typeof buildMoments>, elapsed: number) {
  const nextIndex = moments.findIndex(moment => moment.at > elapsed);
  if (nextIndex < 0) return moments[moments.length - 1].elements;
  if (nextIndex === 0) return moments[0].elements;
  const from = moments[nextIndex - 1];
  const to = moments[nextIndex];
  const fraction = clamp((elapsed - from.at) / (to.at - from.at));
  return from.elements.map((item, index) => {
    const end = to.elements[index].position;
    if (end === item.position || fraction === 0) return item;
    const { x, y } = item.position;
    return { ...item, position: { x: x + (end.x - x) * fraction, y: y + (end.y - y) * fraction } };
  });
}

export function updateMoment(diagram: Diagram, index: number, before: FieldElement[], after: FieldElement[]) {
  if (index === 0) return { ...diagram, elements: after };
  const keyframes = diagram.keyframes.slice();
  const frame = keyframes[index - 1];
  const positions = { ...frame.positions };
  after.forEach((item, i) => {
    const previous = before[i].position;
    if (canAnimate(item) && (previous.x !== item.position.x || previous.y !== item.position.y)) {
      positions[item.id] = item.position;
    }
  });
  keyframes[index - 1] = { ...frame, positions };
  return { ...diagram, keyframes };
}

export function deleteMoment(diagram: Diagram, index: number) {
  if (index < 1 || index > diagram.keyframes.length) return diagram;
  const keyframes = diagram.keyframes.slice();
  const [removed] = keyframes.splice(index - 1, 1);
  const following = keyframes[index - 1];
  if (following) {
    keyframes[index - 1] = { ...following, positions: { ...removed.positions, ...following.positions } };
  }
  return { ...diagram, keyframes };
}
