import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Pitch, localPoint } from './Pitch';
import { type Diagram, type Exercise, type FieldElement, type Point, clamp, dotKinds, drawingKinds, moveElements, presets } from './model';

type Tool = 'select' | 'pan' | typeof dotKinds[number] | typeof drawingKinds[number];
type Team = 'home' | 'away' | 'neutral';
type Interaction = {
  mode: 'move' | 'mark' | 'pan';
  pointerId: number;
  start: Point;
  raw: Point;
  base: Diagram;
  ids: Set<string>;
  pan: Point;
  matrix: DOMMatrix;
};
const icon: Record<Tool, string> = {
  select: '↖', pan: '✥', player: '●', ball: '◉', cone: '▲', pole: '│', mannequin: '♟', marker: '⬭', 'mini goal': '⊓',
  goal: '▣', gate: '· ·', movement: '↗', pass: '⇢', dribble: '⤴', dashed: '┄', zone: '□', label: 'T',
};
const teamColours = { home: '#f4c85f', away: '#79b7ff', neutral: '#f0f4e7' };
const labels: Partial<Record<Tool, string>> = { player: 'Player', goal: 'Full-size goal', marker: 'Flat marker', movement: 'Movement arrow', pass: 'Passing arrow', dribble: 'Dribbling path', dashed: 'Dashed line', label: 'Label' };
const toolName = (tool: Tool) => labels[tool] ?? tool[0].toUpperCase() + tool.slice(1);

export function Studio({ exercise, onChange, onSave }: {
  exercise: Exercise;
  onChange: (exercise: Exercise) => void;
  onSave: () => void;
}) {
  const diagram = exercise.diagram;
  const svg = useRef<SVGSVGElement>(null);
  const group = useRef<SVGGElement>(null);
  const interaction = useRef<Interaction | null>(null);
  const [past, setPast] = useState<Diagram[]>([]);
  const [future, setFuture] = useState<Diagram[]>([]);
  const [multi, setMulti] = useState(false);
  const [selection, select] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [team, setTeam] = useState<Team>('home');
  const [label, setLabel] = useState('');
  const [snap, setSnap] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draft, setDraft] = useState<Diagram>();
  const [preview, setPreview] = useState<FieldElement>();
  const [notice, setNotice] = useState('');
  const selected = diagram.elements.filter(item => selection.includes(item.id));
  const numberUsed = new Set(diagram.elements.flatMap(item => item.kind === 'player' && item.team === team && item.number ? [item.number] : []));
  const change = (value: Diagram) => {
    onChange({ ...exercise, diagram: value });
  };
  const commit = (value: Diagram) => {
    setPast(history => [...history.slice(-99), diagram]);
    setFuture([]);
    change(value);
  };
  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture(history => [diagram, ...history]);
    setPast(past.slice(0, -1));
    change(previous);
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setPast(history => [...history, diagram]);
    setFuture(future.slice(1));
    change(next);
  }
  function remove() {
    if (!selected.length) return;
    const ids = new Set(selection);
    commit({
      ...diagram,
      elements: diagram.elements.filter(item => !ids.has(item.id)),
      keyframes: diagram.keyframes.map(frame => ({
        ...frame, positions: Object.fromEntries(Object.entries(frame.positions).filter(([id]) => !ids.has(id))),
      })),
    });
    select([]);
  }
  function duplicate() {
    if (!selected.length || diagram.elements.length + selected.length > 500) return;
    const copies = moveElements(selected, new Set(selection), .035, .04)
      .map(item => ({ ...item, id: crypto.randomUUID() }));
    commit({ ...diagram, elements: [...diagram.elements, ...copies] });
    select(copies.map(item => item.id));
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.altKey) return;
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      if (command && key === 's') { event.preventDefault(); onSave(); return; }
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable]')) return;
      if (command && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if (command && key === 'y') { event.preventDefault(); redo(); }
      if (command && key === 'd') { event.preventDefault(); duplicate(); }
      if (command && key === 'a') { event.preventDefault(); select(diagram.elements.map(item => item.id)); }
      if (key === 'delete' || key === 'backspace') { event.preventDefault(); remove(); }
      if (key === 'escape') { select([]); setTool('select'); }
      const vectors: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
      const vector = vectors[key];
      if (vector && selected.length && !command) {
        event.preventDefault();
        const [x, y] = diagram.pitch.orientation === 'vertical' ? [vector[1], -vector[0]] : vector;
        commit({ ...diagram, elements: moveElements(diagram.elements, new Set(selection), x / diagram.pitch.length, y / diagram.pitch.width) });
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });

  function point(event: PointerEvent, matrix: DOMMatrix) {
    const { length, width } = diagram.pitch;
    const p = localPoint(matrix, event.clientX, event.clientY, length, width);
    return snap ? { x: clamp(Math.round(p.x * length) / length), y: clamp(Math.round(p.y * width) / width) } : p;
  }
  function drawing(start: Point, end: Point): FieldElement {
    return { id: crypto.randomUUID(), kind: tool as typeof drawingKinds[number], colour: '#f7e17e',
      position: start, end };
  }
  function down(event: PointerEvent<SVGSVGElement>) {
    if (interaction.current || event.button !== 0) return;
    const matrix = group.current?.getScreenCTM();
    const svgMatrix = svg.current?.getScreenCTM();
    if (!matrix || !svgMatrix) return;
    const start = point(event, matrix);
    const raw = { x: event.clientX, y: event.clientY };
    const local = new DOMPoint(raw.x, raw.y).matrixTransform(matrix.inverse());
    if (tool !== 'select' && tool !== 'pan' && (local.x < 0 || local.y < 0 || local.x > diagram.pitch.length || local.y > diagram.pitch.width)) return;
    const pointerId = event.pointerId;
    const target = (event.target as Element).closest('[data-element]')?.getAttribute('data-element');
    if (tool === 'select') {
      if (!target) { select([]); return; }
      const toggle = multi || event.shiftKey || event.metaKey || event.ctrlKey;
      const ids = toggle ? selection.includes(target) ? selection.filter(id => id !== target) : [...selection, target]
        : selection.includes(target) ? selection : [target];
      select(ids);
      if (!ids.includes(target)) return;
      interaction.current = { mode: 'move', pointerId, start, raw, base: diagram, ids: new Set(ids), pan, matrix };
    } else if (tool === 'pan') {
      interaction.current = { mode: 'pan', pointerId, start, raw, base: diagram, ids: new Set(), pan, matrix: svgMatrix };
    } else if (diagram.elements.length >= 500) {
      setNotice('This diagram has reached its 500-element limit.');
      return;
    } else if (drawingKinds.some(kind => kind === tool) && tool !== 'label') {
      interaction.current = { mode: 'mark', pointerId, start, raw, base: diagram, ids: new Set(), pan, matrix };
    } else {
      if (tool === 'label' && !label.trim()) { setNotice('Enter the label text first.'); return; }
      const colour = tool === 'player' ? teamColours[team] : tool === 'cone' ? '#ff925e' : '#f6f5eb';
      const id = crypto.randomUUID();
      const base = { id, colour, position: start };
      const item: FieldElement = tool === 'label'
        ? { ...base, kind: 'label', text: label.trim() }
        : { ...base, kind: tool as typeof dotKinds[number], ...(tool === 'player' ? { team, number: Array.from({ length: 99 }, (_, i) => i + 1).find(i => !numberUsed.has(i)) } : {}) };
      commit({ ...diagram, elements: [...diagram.elements, item] });
      select([id]);
      setNotice('');
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const active = interaction.current;
    if (active?.pointerId !== event.pointerId) return;
    if (active.mode === 'pan') {
      const inverse = active.matrix.inverse();
      const a = new DOMPoint(active.raw.x, active.raw.y).matrixTransform(inverse);
      const b = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
      setPan({ x: active.pan.x + a.x - b.x, y: active.pan.y + a.y - b.y });
      return;
    }
    const p = point(event, active.matrix);
    if (active.mode === 'mark') setPreview(drawing(active.start, p));
    else setDraft({ ...active.base, elements: moveElements(active.base.elements, active.ids, p.x - active.start.x, p.y - active.start.y) });
  }
  function cancel() {
    interaction.current = null;
    setDraft(undefined);
    setPreview(undefined);
  }
  function up(event: PointerEvent<SVGSVGElement>) {
    const active = interaction.current;
    if (active?.pointerId !== event.pointerId) return;
    if (active.mode !== 'pan' && Math.hypot(event.clientX - active.raw.x, event.clientY - active.raw.y) > 3) {
      const p = point(event, active.matrix);
      if (active.mode === 'mark') {
        const item = drawing(active.start, p);
        commit({ ...diagram, elements: [...diagram.elements, item] });
        select([item.id]);
      } else {
        commit({ ...active.base, elements: moveElements(active.base.elements, active.ids, p.x - active.start.x, p.y - active.start.y) });
      }
    }
    cancel();
  }

  function exportPng() {
    const source = svg.current;
    if (!source) return;
    setNotice('');
    const copy = source.cloneNode(true) as SVGSVGElement;
    copy.querySelectorAll('[data-selection], [data-hit]').forEach(node => node.remove());
    const viewBox = source.dataset.exportViewbox!;
    const [, , width, height] = viewBox.split(' ').map(Number);
    copy.setAttribute('viewBox', viewBox);
    const scale = 1600 / Math.max(width, height);
    copy.setAttribute('width', String(Math.round(width * scale)));
    copy.setAttribute('height', String(Math.round(height * scale)));
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      canvas.getContext('2d')?.drawImage(image, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) { setNotice('PNG export failed.'); return; }
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${exercise.title || 'exercise'}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      });
    };
    image.onerror = () => { URL.revokeObjectURL(url); setNotice('PNG export failed.'); };
    image.src = url;
  }

  const pitch = diagram.pitch;
  const updatePitch = (value: Partial<Diagram['pitch']>) => {
    commit({ ...diagram, pitch: { ...pitch, ...value } });
  };
  const patchSelected = (patch: { colour?: string; team?: Team }) => {
    commit({ ...diagram, elements: diagram.elements.map(item => selection.includes(item.id)
      ? { ...item, ...(patch.colour ? { colour: patch.colour } : {}), ...(item.kind === 'player' && patch.team ? { team: patch.team, colour: teamColours[patch.team] } : {}) }
      : item) });
  };
  const toolButton = (item: Tool) => <button key={item} type="button" aria-label={toolName(item)} title={toolName(item)} aria-pressed={tool === item}
    onClick={() => { setTool(item); setNotice(''); }}><span aria-hidden="true">{icon[item]}</span><small>{toolName(item)}</small></button>;

  return <section className="editor" aria-label="Diagram editor">
    <div className="canvas-header">
      <div className="button-row">
        <select aria-label="Pitch preset" value={pitch.preset} onChange={e => {
          const preset = e.target.value as keyof typeof presets;
          updatePitch({ preset, length: presets[preset].length, width: presets[preset].width });
          setPan({ x: 0, y: 0 }); setZoom(1);
        }}>{Object.entries(presets).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}</select>
        <button aria-label="Undo" title="Undo (Ctrl/Command Z)" disabled={!past.length} onClick={undo}>↶</button>
        <button aria-label="Redo" title="Redo (Ctrl/Command Shift Z)" disabled={!future.length} onClick={redo}>↷</button>
      </div>
      <div className="button-row">
        <button onClick={exportPng}>Export PNG</button>
        <details className="pitch-settings"><summary>Pitch settings</summary>
          <div className="settings-popover">
            <label>Length (m)<input key={`l-${pitch.length}`} aria-label="Pitch length" type="number" min="5" max="120" defaultValue={pitch.length}
              onBlur={e => { const length = e.currentTarget.valueAsNumber; if (length >= 5 && length <= 120 && length !== pitch.length) updatePitch({ length }); else e.currentTarget.value = String(pitch.length); }} /></label>
            <label>Width (m)<input key={`w-${pitch.width}`} aria-label="Pitch width" type="number" min="5" max="90" defaultValue={pitch.width}
              onBlur={e => { const width = e.currentTarget.valueAsNumber; if (width >= 5 && width <= 90 && width !== pitch.width) updatePitch({ width }); else e.currentTarget.value = String(pitch.width); }} /></label>
            <label>Orientation<select value={pitch.orientation} onChange={e => { updatePitch({ orientation: e.target.value as 'horizontal' | 'vertical' }); setPan({ x: 0, y: 0 }); }}>
              <option value="horizontal">Horizontal</option><option value="vertical">Vertical</option>
            </select></label>
            <label className="check">Pitch colour<input type="color" aria-label="Pitch colour" value={pitch.colour} onChange={e => updatePitch({ colour: e.target.value })} /></label>
            <label className="check"><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} /> Snap to metre grid</label>
            <label className="check"><input type="checkbox" checked={diagram.showNumbers} onChange={e => commit({ ...diagram, showNumbers: e.target.checked })} /> Show player numbers</label>
            <button className="danger" disabled={!diagram.elements.length} onClick={() => {
              if (confirm('Clear every element from this pitch?')) { commit({ ...diagram, elements: [], keyframes: [] }); select([]); }
            }}>Clear pitch</button>
          </div>
        </details>
      </div>
    </div>
    <div className="editor-workspace">
      <div className="tools" aria-label="Pitch tools">
        <div className="tool-group">{(['select', 'pan'] as const).map(toolButton)}</div>
        <div className="tool-group">{dotKinds.map(toolButton)}</div>
        <div className="tool-group">{drawingKinds.map(toolButton)}</div>
      </div>
      <div className="field-panel">
        <div className={`canvas canvas-${tool === 'pan' ? 'pan' : tool === 'select' ? 'select' : 'place'}`}>
          <Pitch diagram={draft ?? diagram} groupRef={group} svgRef={svg} selection={selection} zoom={zoom} pan={pan} preview={preview}
            onDown={down} onMove={move} onUp={up} onCancel={event => { if (interaction.current?.pointerId === event.pointerId) cancel(); }} />
        </div>
        <div className="canvas-footer">
          <span>{pitch.length} × {pitch.width} m <span className="divider">·</span> {diagram.elements.filter(item => item.kind === 'player').length} players</span>
          <div className="button-row zoom">
            <button aria-label="Zoom out" disabled={zoom <= 1} onClick={() => { setZoom(Math.max(1, zoom - .25)); if (zoom <= 1.25) setPan({ x: 0, y: 0 }); }}>−</button>
            <button title="Reset view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>{Math.round(zoom * 100)}%</button>
            <button aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(Math.min(3, zoom + .25))}>+</button>
          </div>
        </div>
      </div>
    </div>
    <div className="context">
      {tool === 'select' && <button aria-pressed={multi} onClick={() => setMulti(!multi)}>{multi ? 'Multi-select on' : 'Multi-select'}</button>}
      {tool === 'player' && <label>Place player for <select value={team} onChange={e => setTeam(e.target.value as Team)}><option value="home">Home</option><option value="away">Away</option><option value="neutral">Neutral</option></select></label>}
      {tool === 'label' && <label>Label text <input maxLength={90} value={label} onChange={e => setLabel(e.target.value)} /></label>}
      {selected.length > 0 && <>
        <span>{selected.length} selected</span>
        <label>Colour <input aria-label="Element colour" type="color" value={selected[0].colour} onChange={e => patchSelected({ colour: e.target.value })} /></label>
        {selected.every(item => item.kind === 'player') && <label>Team <select aria-label="Selected team" value={selected.every(item => item.kind === 'player' && item.team === (selected[0].kind === 'player' && selected[0].team)) && selected[0].kind === 'player' ? selected[0].team ?? '' : ''} onChange={e => patchSelected({ team: e.target.value as Team })}>
          <option value="" disabled>Mixed</option><option value="home">Home</option><option value="away">Away</option><option value="neutral">Neutral</option>
        </select></label>}
        <button onClick={duplicate}>Duplicate</button><button className="danger" onClick={remove}>Delete selection</button>
        {tool === 'select' && <button onClick={() => select(diagram.elements.map(item => item.id))}>Select all</button>}
      </>}
      {!selected.length && tool === 'select' && <span>Drag to move an element. Shift-click to select several.</span>}
      {!selected.length && tool !== 'select' && tool !== 'pan' && <span>{drawingKinds.some(item => item === tool) && tool !== 'label' ? 'Drag across the pitch to draw.' : 'Click or tap the pitch to place.'}</span>}
      {notice && <span role="status">{notice}</span>}
    </div>
  </section>;
}
