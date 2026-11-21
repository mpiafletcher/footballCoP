import { useState } from 'react';
import { ElementSymbol } from './Pitch';
import { dotKinds, drawingKinds } from './model';

export type Tool = 'select' | 'pan' | typeof dotKinds[number] | typeof drawingKinds[number];

const categories = [
  { name: 'Players & ball', tools: ['player', 'ball'] },
  { name: 'Equipment', tools: dotKinds.filter(kind => kind !== 'player' && kind !== 'ball') },
  { name: 'Drawing', tools: drawingKinds },
] as const;

const labels: Record<Tool, string> = {
  select: 'Select', pan: 'Pan', player: 'Player', ball: 'Ball', cone: 'Cone', pole: 'Training pole',
  mannequin: 'Mannequin', marker: 'Flat marker', 'mini goal': 'Mini goal', goal: 'Full-size goal', gate: 'Training gate',
  movement: 'Movement arrow', pass: 'Passing arrow', dribble: 'Dribbling path', dashed: 'Dashed line', zone: 'Zone', label: 'Label',
};

const paths = {
  movement: 'M-3 2L3 -2 M0 -2H3V1',
  pass: 'M-3 2L3 -2',
  dribble: 'M-3 2C-3 -3 1 3 3 -2 M.5 -1.5L3 -2L3.5 .5',
  dashed: 'M-3 0H3',
  zone: 'M-3 -2H3V2H-3Z',
  label: 'M-2 -2.5H2M0 -2.5V2.5 M-1 2.5H1',
} as const;

function Preview({ kind, playerColour }: { kind: Tool; playerColour: string }) {
  if (kind === 'select' || kind === 'pan') {
    return <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={kind === 'select' ? 'M6 4l11 9-5 1-2 5z' : 'M12 3v18M3 12h18M9 6l3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3'}
        fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>;
  }
  return <svg className="tool-preview" viewBox="-5 -4 10 8" aria-hidden="true">
    {kind in paths ? <>
      <path d={paths[kind as keyof typeof paths]} fill={kind === 'zone' ? '#f7e17e45' : 'none'} stroke="#f7e17e"
        strokeWidth=".45" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={kind === 'pass' || kind === 'dashed' ? '1 .65' : undefined} />
      {kind === 'pass' && <path d="M.8 -2H3V.2" fill="none" stroke="#f7e17e" strokeWidth=".45" />}
    </> : <ElementSymbol item={{ kind, colour: kind === 'player' ? playerColour : kind === 'cone' ? '#ff925e' : '#f6f5eb', number: 8 }} showNumbers />}
  </svg>;
}

export function ToolPalette({ tool, playerColour, previewing, laterMoment, onSelect, undo, canUndo }: {
  tool: Tool;
  playerColour: string;
  previewing: boolean;
  laterMoment: boolean;
  onSelect: (tool: Tool) => void;
  undo: () => void;
  canUndo: boolean;
}) {
  const [drawer, setDrawer] = useState(false);
  const [category, setCategory] = useState(0);
  function button(kind: Tool) {
    return <button className="tool-option" key={kind} type="button" aria-pressed={tool === kind}
      disabled={previewing || (laterMoment && kind !== 'select' && kind !== 'pan')}
      onClick={() => { onSelect(kind); setDrawer(false); }}>
      <Preview kind={kind} playerColour={playerColour} />
      <span>{labels[kind]}</span>
    </button>;
  }

  return <aside className="tools" aria-label="Pitch tools">
    <div className="touch-tools" aria-label="Quick tools">
      {button('select')}{!laterMoment && <>{button('player')}{button('ball')}</>}
      <button type="button" onClick={undo} disabled={!canUndo}>Undo last edit</button>
      {!laterMoment && <button type="button" aria-expanded={drawer} onClick={() => setDrawer(!drawer)}>{drawer ? 'Close tools' : 'More tools'}</button>}
      {laterMoment && button('pan')}
    </div>
    <div className={`tool-browser${drawer ? ' tool-browser-open' : ''}`}>
      <div className="tool-sheet-header"><strong>Pitch tools</strong><button type="button" onClick={() => setDrawer(false)}>Close</button></div>
      <div className="tool-navigation">{button('select')}{button('pan')}</div>
      <div className="tool-categories" role="group" aria-label="Element categories">
        {categories.map(({ name, tools }, index) => <button type="button" key={name} aria-pressed={category === index}
          onClick={() => {
            setCategory(index);
            if (tool !== 'select' && tool !== 'pan' && !tools.some(item => item === tool)) onSelect('select');
          }}>{name}</button>)}
      </div>
      {laterMoment
        ? <p className="tool-hint">Add elements in Moment 1.</p>
        : <div className="tool-items" role="group" aria-label={categories[category].name}>{categories[category].tools.map(button)}</div>}
    </div>
  </aside>;
}
