import { z } from 'zod';

export const presets = {
  full: { label: 'Full pitch', length: 105, width: 68 },
  half: { label: 'Half pitch', length: 52.5, width: 68 },
  third: { label: 'Attacking third', length: 35, width: 68 },
  penalty: { label: 'Penalty area', length: 16.5, width: 40.32 },
  blank: { label: 'Blank area', length: 30, width: 20 },
  custom: { label: 'Custom rectangle', length: 24, width: 18 },
} as const;
export const dotKinds = ['player', 'ball', 'cone', 'pole', 'mannequin', 'marker', 'mini goal', 'goal', 'gate'] as const;
export const drawingKinds = ['movement', 'pass', 'dribble', 'dashed', 'zone', 'label'] as const;
const coordinate = z.number().min(0).max(1);
export const point = z.object({ x: coordinate, y: coordinate });
const colour = z.string().regex(/^#[0-9a-f]{6}$/i);
const base = z.object({ id: z.uuid(), colour });
const dot = base.extend({
  kind: z.enum(dotKinds),
  position: point,
  team: z.enum(['home', 'away', 'neutral']).optional(),
  number: z.number().int().min(1).max(99).optional(),
});
const drawing = base.extend({
  kind: z.enum(drawingKinds),
  position: point,
  end: point.optional(),
  text: z.string().max(90).optional(),
}).refine(item => item.kind === 'label' ? !!item.text?.trim() : !!item.end);
const element = z.union([dot, drawing]);
const frame = z.object({ durationMs: z.number().int().min(100).max(30000), positions: z.record(z.uuid(), point) });
export const diagramSchema = z.object({
  version: z.literal(1),
  pitch: z.object({
    preset: z.enum(['full', 'half', 'third', 'penalty', 'blank', 'custom']),
    length: z.number().min(5).max(120),
    width: z.number().min(5).max(90),
    orientation: z.enum(['horizontal', 'vertical']),
    colour,
  }),
  showNumbers: z.boolean(),
  elements: z.array(element).max(500),
  keyframes: z.array(frame).max(100),
}).refine(diagram => new Set(diagram.elements.map(item => item.id)).size === diagram.elements.length);
export const exerciseSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().max(4000),
  objective: z.string().max(500),
  age: z.string().max(60),
  playerCount: z.number().int().min(0).max(500),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
  visibility: z.enum(['private', 'unlisted', 'public']),
  diagram: diagramSchema,
});
export type Point = z.infer<typeof point>;
export type Diagram = z.infer<typeof diagramSchema>;
export type FieldElement = z.infer<typeof element>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type SavedExercise = Exercise & { id: string; updated_at: string };
export type LibraryEntry = Pick<SavedExercise, 'id' | 'title' | 'visibility' | 'updated_at'>;
export function newExercise(): Exercise {
  return {
    title: 'Untitled exercise', description: '', objective: '', age: '', playerCount: 0,
    tags: [], visibility: 'private',
    diagram: {
      version: 1, pitch: { preset: 'full', length: 105, width: 68, orientation: 'horizontal', colour: '#205d44' },
      elements: [], showNumbers: true, keyframes: [],
    },
  };
}
export function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
export function moveElements(elements: FieldElement[], selected: Set<string>, dx: number, dy: number) {
  const points = elements.filter(item => selected.has(item.id)).flatMap(item =>
    'end' in item && item.end ? [item.position, item.end] : [item.position]);
  if (!points.length) return elements;
  const x = Math.max(-Math.min(...points.map(p => p.x)), Math.min(dx, 1 - Math.max(...points.map(p => p.x))));
  const y = Math.max(-Math.min(...points.map(p => p.y)), Math.min(dy, 1 - Math.max(...points.map(p => p.y))));
  const move = (p: Point) => ({ x: clamp(p.x + x), y: clamp(p.y + y) });
  return elements.map(item => selected.has(item.id) ? {
    ...item, position: move(item.position),
    ...('end' in item && item.end ? { end: move(item.end) } : {}),
  } : item);
}
