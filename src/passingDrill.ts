import { newExercise, type FieldElement, type Point } from './model';

const patterns = [
  { name: 'Diamond passing', points: [[.16, .5], [.5, .17], [.84, .5], [.5, .83]], path: [0, 1, 2, 3, 0] },
  { name: 'Zigzag passing', points: [[.18, .25], [.39, .7], [.62, .26], [.83, .71]], path: [0, 1, 2, 3, 0] },
  { name: 'Third-player combination', points: [[.18, .55], [.44, .3], [.60, .72], [.83, .44]], path: [0, 1, 2, 3, 1] },
] as const;

export function randomPassingDrill(random = Math.random) {
  const pattern = patterns[Math.floor(random() * patterns.length)];
  const flip = random() < .5;
  const points: Point[] = pattern.points.map(([x, y]) => ({ x, y: flip ? 1 - y : y }));
  const ballPosition = (index: number) => ({ ...points[index], y: points[index].y + .065 });
  const players: FieldElement[] = points.map((position, index) => ({
    id: crypto.randomUUID(), kind: 'player', position, colour: '#f4c85f', team: 'home', number: index + 1,
  }));
  const ball: FieldElement = { id: crypto.randomUUID(), kind: 'ball', colour: '#f6f5eb', position: ballPosition(pattern.path[0]) };
  const exercise = newExercise();
  exercise.title = pattern.name;
  exercise.objective = 'Receive on the back foot and pass accurately into the next player’s path.';
  exercise.description = `Start with player 1. Follow the pass sequence ${pattern.path.map(index => index + 1).join(' → ')}. Repeat in the opposite direction, then challenge the group to play in two touches.`;
  exercise.playerCount = players.length;
  exercise.tags = ['Passing'];
  exercise.diagram.pitch = { ...exercise.diagram.pitch, preset: 'custom', length: 24, width: 18 };
  exercise.diagram.elements = [...players, ball];
  exercise.diagram.keyframes = pattern.path.slice(1).map(index => ({
    durationMs: 900 + Math.floor(random() * 500),
    positions: { [ball.id]: ballPosition(index) },
  }));
  return exercise;
}
