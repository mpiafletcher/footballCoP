import { type PointerEventHandler, type Ref } from 'react';
import { type Diagram, type FieldElement, type Point, clamp } from './model';

export function localPoint(matrix: DOMMatrix, x: number, y: number, length: number, width: number): Point {
  const position = new DOMPoint(x, y).matrixTransform(matrix.inverse());
  return { x: clamp(position.x / length), y: clamp(position.y / width) };
}

function Markings({ pitch }: { pitch: Diagram['pitch'] }) {
  const { length: L, width: W, preset } = pitch;
  const mid = W / 2;
  const depth = preset === 'penalty' ? L : Math.min(16.5, L * .48);
  const boxWidth = preset === 'penalty' ? W : Math.min(W * .94, 40.32);
  const goalArea = Math.min(W * .8, 18.32);
  const spots = Math.min(11, depth * .75);
  const spotDepth = spots;
  const radius = Math.min(9.15, W * .22, L * .35);
  const arcHalf = Math.sqrt(Math.max(0, radius ** 2 - (depth - spotDepth) ** 2));
  const end = <g>
    <rect x="0" y={mid - boxWidth / 2} width={depth} height={boxWidth} />
    <rect x="0" y={mid - goalArea / 2} width={Math.min(5.5, depth * .55)} height={goalArea} />
    <circle cx={spotDepth} cy={mid} r=".24" fill="currentColor" />
    {preset !== 'penalty' && arcHalf > 0 && <path d={`M ${depth} ${mid - arcHalf} A ${radius} ${radius} 0 0 1 ${depth} ${mid + arcHalf}`} />}
    {preset !== 'penalty' && <path d={`M 1 0 A 1 1 0 0 1 0 1 M 0 ${W - 1} A 1 1 0 0 1 1 ${W}`} />}
  </g>;
  return <g fill="none" color="#e5f2d9" stroke="currentColor" strokeWidth={Math.min(.12, Math.min(L, W) * .016)} opacity=".82">
    <rect width={L} height={W} />
    {['full', 'half', 'third', 'penalty'].includes(preset) && end}
    {preset === 'full' && <g>
      <g transform={`translate(${L} 0) scale(-1 1)`}>{end}</g>
      <path d={`M ${L / 2} 0 V ${W}`} />
      <circle cx={L / 2} cy={mid} r={radius} />
      <circle cx={L / 2} cy={mid} r=".24" fill="currentColor" />
    </g>}
    {preset === 'half' && <path d={`M ${L} ${mid - radius} A ${radius} ${radius} 0 0 0 ${L} ${mid + radius}`} />}
  </g>;
}

function Symbol({ item, showNumbers }: { item: FieldElement; showNumbers: boolean }) {
  const fill = item.colour;
  const outline = '#14291f';
  switch (item.kind) {
    case 'player':
      return <><circle r="2.8" fill={fill} stroke="#fff" strokeWidth=".32" />
        {showNumbers && item.number && <text y=".09" textAnchor="middle" dominantBaseline="central" fill={outline} stroke="#fff" strokeWidth=".45" paintOrder="stroke" fontSize="2.45" fontWeight="800">{item.number}</text>}</>;
    case 'ball':
      return <><circle r="1.66" fill={fill} stroke={outline} strokeWidth=".24" /><path d="M0 -1 L.95 -.3 L.57 .8 H-.57 L-.95 -.3Z" fill={outline} /></>;
    case 'cone':
      return <path d="M0 -2.4 L1.8 1.8 H-1.8Z" fill={fill} stroke="#fff" strokeWidth=".25" />;
    case 'pole':
      return <path d="M-1.5 2 H1.5 M0 2 V-2.8" fill="none" stroke={fill} strokeWidth=".72" strokeLinecap="round" />;
    case 'mannequin':
      return <g fill={fill} stroke={outline} strokeWidth=".2"><circle cy="-1.8" r=".95" /><path d="M-1.6 -.6 H1.6 L1 2.1 H-1Z" /></g>;
    case 'marker':
      return <ellipse rx="1.55" ry="1.04" fill={fill} stroke="#fff" strokeWidth=".22" />;
    case 'gate':
      return <g fill={fill} stroke="#fff" strokeWidth=".25"><circle cx="-2" r=".85" /><circle cx="2" r=".85" /></g>;
    case 'goal':
    case 'mini goal': {
      const half = item.kind === 'goal' ? 3.5 : 2.1;
      return <g stroke={fill} strokeWidth=".5" fill="none"><path d={`M ${-half} 1.25 V -1.25 H ${half} V 1.25`} /><path d={`M ${-half} -.35 H ${half} M 0 -1.25 V 1.25`} opacity=".55" /></g>;
    }
    default:
      return null;
  }
}

export function Pitch({ diagram, groupRef, svgRef, selection = [], zoom = 1, pan = { x: 0, y: 0 }, preview, onDown, onMove, onUp, onCancel }: {
  diagram: Diagram;
  groupRef?: Ref<SVGGElement>;
  svgRef?: Ref<SVGSVGElement>;
  selection?: string[];
  zoom?: number;
  pan?: Point;
  preview?: FieldElement;
  onDown?: PointerEventHandler<SVGSVGElement>;
  onMove?: PointerEventHandler<SVGSVGElement>;
  onUp?: PointerEventHandler<SVGSVGElement>;
  onCancel?: PointerEventHandler<SVGSVGElement>;
}) {
  const { length: L, width: W, colour, orientation } = diagram.pitch;
  const vertical = orientation === 'vertical';
  const scale = Math.min(L, W) / 68;
  const margin = scale * 4;
  const fieldWidth = (vertical ? W : L) + 2 * margin;
  const fieldHeight = (vertical ? L : W) + 2 * margin;
  const items = preview ? [...diagram.elements, preview] : diagram.elements;
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" className="pitch" role="img" aria-label="Football exercise pitch"
    viewBox={`${-margin + pan.x} ${-margin + pan.y} ${fieldWidth / zoom} ${fieldHeight / zoom}`}
    data-export-viewbox={`${-margin} ${-margin} ${fieldWidth} ${fieldHeight}`}
    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} onLostPointerCapture={onCancel}>
    <defs>
      {items.filter(item => ['movement', 'pass', 'dribble'].includes(item.kind)).map(item =>
        <marker key={item.id} id={`arrow-${item.id}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0L8 4L0 8Z" fill={item.colour} />
        </marker>
      )}
    </defs>
    <g ref={groupRef} transform={vertical ? `translate(${W} 0) rotate(90)` : undefined}>
      <rect x={-margin} y={-margin} width={L + 2 * margin} height={W + 2 * margin} rx={margin * .4} fill={colour} />
      {Array.from({ length: 5 }, (_, index) => <rect key={index} x={L * index / 5} width={L / 10} height={W} fill="#fff" opacity=".042" />)}
      <Markings pitch={diagram.pitch} />
      {items.map(item => {
        const { x, y } = { x: item.position.x * L, y: item.position.y * W };
        const selected = selection.includes(item.id);
        const end = 'end' in item ? item.end : undefined;
        return <g key={item.id} data-element={item.id} data-kind={item.kind} className={selected ? 'pitch-item selected' : 'pitch-item'} opacity={item === preview ? .6 : 1}>
          {end ? (() => {
            const ex = end.x * L;
            const ey = end.y * W;
            const path = item.kind === 'dribble'
              ? `M ${x} ${y} Q ${(x + ex) / 2 + (ey - y) * .23} ${(ey + y) / 2 - (ex - x) * .23} ${ex} ${ey}`
              : `M ${x} ${y} L ${ex} ${ey}`;
            return item.kind === 'zone'
              ? <rect x={Math.min(x, ex)} y={Math.min(y, ey)} width={Math.abs(ex - x)} height={Math.abs(ey - y)} fill={item.colour} fillOpacity=".27" stroke={selected ? '#fff' : item.colour} strokeWidth={scale * .55} />
              : <>
                <path data-hit="true" d={path} stroke="transparent" strokeWidth={scale * 4} fill="none" />
                <path d={path} stroke={item.colour} strokeWidth={scale * (selected ? .85 : .55)} fill="none"
                  strokeDasharray={['pass', 'dashed'].includes(item.kind) ? `${scale * 1.5} ${scale}` : undefined}
                  markerEnd={['pass', 'movement', 'dribble'].includes(item.kind) ? `url(#arrow-${item.id})` : undefined} />
              </>;
          })() : <g transform={`translate(${x} ${y}) ${vertical ? 'rotate(-90)' : ''} scale(${scale})`}>
            {item.kind === 'label'
              ? <text fill={item.colour} stroke={selected ? '#fff' : '#14291f'} strokeWidth=".45" paintOrder="stroke" fontSize="3.1" fontFamily="sans-serif" fontWeight="700">{item.text}</text>
              : <><circle data-hit="true" r="4" fill="transparent" />{selected && <circle data-selection="true" r="3.55" fill="none" stroke="#f8f4b9" strokeWidth=".33" />}<Symbol item={item} showNumbers={diagram.showNumbers} /></>}
          </g>}
        </g>;
      })}
    </g>
  </svg>;
}
