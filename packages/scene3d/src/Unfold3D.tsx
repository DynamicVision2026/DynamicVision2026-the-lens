// 展開 in 3D (WO-012): spin the cuboid, drag face BCGF open around BF, then slide P along BF until
// the string A→P→G is straight. P snaps only at the verified answer. Rendered on demand.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { fitScale, nearSnap, openEnough, vertices, type BoxDims, type V3, type VertexName } from './geometry';

export type Anchor = 'face' | 'p';

export interface Unfold3DProps {
  dims: BoxDims;
  /** The validator's figure.mesh vertices, when the card has them. */
  mesh?: Record<VertexName, V3>;
  /** BP from the card's answer: the only place P snaps. */
  answer: number;
  /** Printed labels: vertex letters, the three given lengths, and P's label after the snap. */
  labels: { points: Record<string, string>; ab: string; bc: string; bf: string; solvedP: string };
  colors: { lens: string; ink: string; front: string; face: string; paper: string };
  /** Screen position (relative to the container) of a coaching target, filled in by the scene. */
  anchors: MutableRefObject<((a: Anchor) => [number, number] | null) | null>;
  onTouch: () => void;
  onOpened: () => void;
  onMiss: (dir: 'up' | 'down') => void;
  onSolved: () => void;
  onContextLost: () => void;
}

type Spring = { x: number; v: number; target: number; k: number; c: number; done?: () => void } | null;

function stepSpring(s: Spring, dt: number): number | null {
  if (!s) return null;
  const a = s.k * (s.target - s.x) - s.c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
  return s.x;
}

function Rod({ from, to, color, r = 0.025, opacity = 1 }: { from: V3; to: V3; color: string; r?: number; opacity?: number }) {
  const { pos, quat, len } = useMemo(() => {
    const p = new THREE.Vector3(...from);
    const q = new THREE.Vector3(...to);
    const d = new THREE.Vector3().subVectors(q, p);
    return {
      pos: p.clone().addScaledVector(d, 0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()),
      len: d.length(),
    };
  }, [from, to]);
  return (
    <mesh position={pos} quaternion={quat}>
      <cylinderGeometry args={[r, r, len, 10]} />
      <meshBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function Quad({ pts, color, opacity }: { pts: [V3, V3, V3, V3]; color: string; opacity: number }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]].map((p) => new THREE.Vector3(...p)));
    g.computeVertexNormals();
    return g;
  }, [pts]);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} emissive={color} emissiveIntensity={0.25} depthWrite={false} />
    </mesh>
  );
}

function Box(props: Unfold3DProps & { labelEls: MutableRefObject<Record<string, HTMLSpanElement | null>> }) {
  const { dims, answer, colors, anchors, labelEls } = props;
  const { camera, gl, invalidate, size } = useThree();
  const k = fitScale(dims);
  const v = vertices(dims, k, props.mesh);
  const [a, b, h] = [dims.a * k, dims.b * k, dims.h * k];
  const pAns = answer * k;

  const root = useRef<THREE.Group>(null);
  const hinge = useRef<THREE.Group>(null);
  const pBall = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const faceMesh = useRef<THREE.Mesh>(null);
  const strA = useRef<THREE.Mesh>(null);
  const strB = useRef<THREE.Mesh>(null);
  const st = useRef({ yaw: -0.55, pitch: 0.32, vyaw: 0, vpitch: 0, phi: 0, pY: h * 0.5, phase: 1 as 1 | 2 | 3, mode: null as null | 'spin' | 'face' | 'p', t: 0 });
  const springs = useRef<Record<string, Spring>>({ phi: null, pY: null, yaw: null, pitch: null });
  const cb = useRef(props);
  cb.current = props;

  // String A→P (on the front face) and P→G (on the hinged face), as thin cylinders.
  const setString = () => {
    const s = st.current;
    const place = (m: THREE.Mesh | null, p: THREE.Vector3, q: THREE.Vector3) => {
      if (!m) return;
      const d = new THREE.Vector3().subVectors(q, p);
      m.position.copy(p).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      m.scale.set(1, d.length(), 1);
    };
    place(strA.current, new THREE.Vector3(0, 0, 0), new THREE.Vector3(a, s.pY, 0));
    place(strB.current, new THREE.Vector3(0, s.pY, 0), new THREE.Vector3(0, h, -b));
    pBall.current?.position.set(a, s.pY, 0);
  };

  const project = (p: THREE.Vector3, parent: THREE.Object3D | null): [number, number] => {
    const w = p.clone();
    (parent ?? root.current?.children[0])?.localToWorld(w);
    w.project(camera);
    return [((w.x + 1) / 2) * size.width, ((1 - w.y) / 2) * size.height];
  };

  useEffect(() => {
    anchors.current = (which) => {
      const model = root.current?.children[0] ?? null;
      if (which === 'face') return hinge.current ? project(new THREE.Vector3(0, h / 2, -b / 2), hinge.current) : null;
      return model ? project(new THREE.Vector3(a, st.current.pY, 0), model) : null;
    };
    return () => {
      anchors.current = null;
    };
  });

  // Pointer: raycast the face (phase 1) and P (phase 2); anything else spins the box.
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    let lx = 0;
    let ly = 0;
    let lt = 0;
    const ndc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const down = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      cb.current.onTouch();
      const s = st.current;
      lx = e.clientX;
      ly = e.clientY;
      lt = performance.now();
      s.vyaw = s.vpitch = 0;
      ray.setFromCamera(ndc(e), camera);
      const targets = [pBall.current, halo.current, faceMesh.current].filter((m): m is THREE.Mesh => !!m);
      const hit = ray.intersectObjects(targets, false)[0]?.object;
      s.mode = 'spin';
      if (hit && (hit === pBall.current || hit === halo.current) && s.phase === 2) s.mode = 'p';
      else if (hit === faceMesh.current && s.phase === 1) s.mode = 'face';
      springs.current.phi = springs.current.pY = null;
      invalidate();
    };
    const move = (e: PointerEvent) => {
      const s = st.current;
      if (!s.mode) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      const now = performance.now();
      const dt = Math.max(8, now - lt);
      lx = e.clientX;
      ly = e.clientY;
      lt = now;
      if (s.mode === 'spin') {
        s.yaw += dx * 0.008;
        s.pitch = Math.max(-0.9, Math.min(1.2, s.pitch + dy * 0.006));
        s.vyaw = ((dx * 0.008) / dt) * 16;
        s.vpitch = ((dy * 0.006) / dt) * 16;
      } else if (s.mode === 'face') {
        s.phi = Math.max(0, Math.min(Math.PI / 2, s.phi + (dx * Math.cos(s.yaw) - dy * 0.2) * 0.009));
      } else if (s.mode === 'p') {
        const model = root.current?.children[0] ?? null;
        const [, y0] = project(new THREE.Vector3(a, 0, 0), model);
        const [, y1] = project(new THREE.Vector3(a, h, 0), model);
        const r = el.getBoundingClientRect();
        s.pY = Math.max(0.02, Math.min(0.98, (y0 - (e.clientY - r.top)) / (y0 - y1))) * h;
      }
      invalidate();
    };
    const up = () => {
      const s = st.current;
      if (s.mode === 'face') {
        if (openEnough(s.phi))
          springs.current.phi = {
            x: s.phi,
            v: 0,
            target: Math.PI / 2,
            k: 300,
            c: 14,
            done: () => {
              if (s.phase !== 1) return;
              s.phase = 2;
              springs.current.yaw = { x: s.yaw, v: 0, target: -0.18, k: 60, c: 14 };
              springs.current.pitch = { x: s.pitch, v: 0, target: 0.12, k: 60, c: 14 };
              cb.current.onOpened();
            },
          };
        else springs.current.phi = { x: s.phi, v: 0, target: 0, k: 260, c: 18 };
      }
      if (s.mode === 'p' && s.phase === 2) {
        if (nearSnap(s.pY, pAns, h)) {
          s.phase = 3;
          springs.current.pY = {
            x: s.pY,
            v: 0,
            target: pAns,
            k: 420,
            c: 15,
            done: () => {
              springs.current.yaw = { x: s.yaw, v: 0, target: 0, k: 50, c: 13 };
              springs.current.pitch = { x: s.pitch, v: 0, target: 0, k: 50, c: 13 };
              if (pBall.current) pBall.current.scale.setScalar(1.3);
              const pl = labelEls.current.P;
              if (pl) pl.textContent = cb.current.labels.solvedP;
              cb.current.onSolved();
            },
          };
        } else cb.current.onMiss(s.pY > pAns ? 'down' : 'up');
      }
      s.mode = null;
      invalidate();
    };
    const lost = (e: Event) => {
      e.preventDefault();
      cb.current.onContextLost();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('webglcontextlost', lost);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('webglcontextlost', lost);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera, size.width, size.height]);

  useFrame((_, dt) => {
    const s = st.current;
    s.t += dt;
    let moving = false;
    for (const key of ['phi', 'pY', 'yaw', 'pitch'] as const) {
      const sp = springs.current[key];
      const x = stepSpring(sp, Math.min(dt, 0.032));
      if (x === null || !sp) continue;
      s[key] = x;
      moving = true;
      if (Math.abs(sp.target - sp.x) < 1e-3 && Math.abs(sp.v) < 1e-3) {
        s[key] = sp.target;
        springs.current[key] = null;
        sp.done?.();
      }
    }
    if (!s.mode && (Math.abs(s.vyaw) > 1e-4 || Math.abs(s.vpitch) > 1e-4)) {
      s.yaw += s.vyaw;
      s.pitch = Math.max(-0.9, Math.min(1.2, s.pitch + s.vpitch));
      s.vyaw *= 0.93;
      s.vpitch *= 0.93;
      moving = true;
    }
    root.current?.rotation.set(s.pitch, s.yaw, 0);
    // A small "try me" wiggle of the face for the first seconds, until the child grabs it.
    const wiggle = s.phase === 1 && !s.mode && s.phi < 0.02 && s.t < 6 ? 0.12 + 0.1 * Math.sin(s.t * 3) : 0;
    if (hinge.current) hinge.current.rotation.y = -(s.phi + wiggle);
    if (halo.current) {
      halo.current.scale.setScalar(1 + 0.25 * Math.sin(s.t * 4));
      (halo.current.material as THREE.MeshBasicMaterial).opacity = s.phase === 2 ? 0.14 + 0.1 * Math.sin(s.t * 4) : 0;
    }
    setString();
    // Labels follow their points.
    const model = root.current?.children[0] ?? null;
    const put = (key: string, p: THREE.Vector3, parent: THREE.Object3D | null, dx = 0, dy = 0) => {
      const el = labelEls.current[key];
      if (!el || !parent) return;
      const [x, y] = project(p, parent);
      el.style.transform = `translate(${x + dx}px, ${y + dy}px) translate(-50%, -50%)`;
    };
    put('A', new THREE.Vector3(...v.A), model, -14, 12);
    put('B', new THREE.Vector3(...v.B), model, 0, 16);
    put('E', new THREE.Vector3(...v.E), model, -14, -10);
    put('F', new THREE.Vector3(...v.F), model, 0, -16);
    put('C', new THREE.Vector3(0, 0, -b), hinge.current, 12, 12);
    put('G', new THREE.Vector3(0, h, -b), hinge.current, 12, -12);
    put('P', new THREE.Vector3(a, s.pY, 0), model, 18, 0);
    put('ab', new THREE.Vector3(a / 2, 0, 0), model, 0, 22);
    put('bc', new THREE.Vector3(0, 0, -b / 2), hinge.current, 0, 22);
    put('bf', new THREE.Vector3(a, h * 0.25, 0), model, -34, 0);
    if (moving || s.mode || wiggle || s.phase === 2) invalidate();
  });

  const solved = st.current.phase === 3;
  const strColor = solved ? colors.lens : colors.ink;
  return (
    <group ref={root}>
      <group position={[-(a + b * 0.3) / 2, -h / 2, b / 2]}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 6, 8]} intensity={0.7} />
        <Quad pts={[v.A, v.B, v.F, v.E]} color={colors.front} opacity={0.16} />
        <Quad pts={[v.D, v.C, v.G, v.H]} color={colors.ink} opacity={0.04} />
        <Quad pts={[v.E, v.F, v.G, v.H]} color={colors.ink} opacity={0.05} />
        <Quad pts={[v.A, v.D, v.H, v.E]} color={colors.ink} opacity={0.03} />
        {(
          [
            [v.A, v.B],
            [v.B, v.F],
            [v.F, v.E],
            [v.E, v.A],
            [v.D, v.C],
            [v.C, v.G],
            [v.G, v.H],
            [v.H, v.D],
            [v.A, v.D],
            [v.E, v.H],
          ] as [V3, V3][]
        ).map(([p, q], i) => (
          <Rod key={i} from={p} to={q} color={colors.ink} r={0.022} opacity={0.75} />
        ))}
        <group ref={hinge} position={v.B}>
          <mesh ref={faceMesh}>
            <bufferGeometry
              onUpdate={(g) => {
                g.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -b), new THREE.Vector3(0, h, -b), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h, -b), new THREE.Vector3(0, h, 0)]);
                g.computeVertexNormals();
              }}
            />
            <meshStandardMaterial color={colors.face} transparent opacity={0.22} side={THREE.DoubleSide} emissive={colors.face} emissiveIntensity={0.25} depthWrite={false} />
          </mesh>
          <Rod from={[0, 0, -b]} to={[0, h, -b]} color={colors.face} r={0.03} />
          <Rod from={[0, 0, 0]} to={[0, 0, -b]} color={colors.face} r={0.03} />
          <Rod from={[0, h, 0]} to={[0, h, -b]} color={colors.face} r={0.03} />
          <mesh ref={strB}>
            <cylinderGeometry args={[solved ? 0.05 : 0.03, solved ? 0.05 : 0.03, 1, 10]} />
            <meshBasicMaterial color={strColor} />
          </mesh>
        </group>
        <Rod from={v.B} to={v.F} color={colors.lens} r={0.045} />
        <mesh ref={strA}>
          <cylinderGeometry args={[solved ? 0.05 : 0.03, solved ? 0.05 : 0.03, 1, 10]} />
          <meshBasicMaterial color={strColor} />
        </mesh>
        <mesh ref={pBall}>
          <sphereGeometry args={[0.17, 24, 16]} />
          <meshStandardMaterial color={colors.lens} emissive={colors.lens} emissiveIntensity={0.9} />
          <mesh ref={halo}>
            <sphereGeometry args={[0.34, 24, 16]} />
            <meshBasicMaterial color={colors.lens} transparent opacity={0} depthWrite={false} />
          </mesh>
        </mesh>
      </group>
    </group>
  );
}

/** The 3D viewport plus its HTML labels. Lazy-load this module; it pulls in Three.js. */
export default function Unfold3D(props: Unfold3DProps) {
  const labelEls = useRef<Record<string, HTMLSpanElement | null>>({});
  const L = props.labels.points;
  const items: [string, string, string][] = [
    ['A', L.A ?? 'A', props.colors.ink],
    ['B', L.B ?? 'B', props.colors.ink],
    ['C', L.C ?? 'C', props.colors.ink],
    ['E', L.E ?? 'E', props.colors.ink],
    ['F', L.F ?? 'F', props.colors.ink],
    ['G', L.G ?? 'G', props.colors.ink],
    ['P', L.P ?? 'P', props.colors.lens],
    ['ab', props.labels.ab, props.colors.front],
    ['bc', props.labels.bc, props.colors.face],
    ['bf', props.labels.bf, props.colors.ink],
  ];
  return (
    <div className="unfold3d" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 36, position: [0, 0, 13], near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }} style={{ touchAction: 'none' }}>
        <Box {...props} labelEls={labelEls} />
      </Canvas>
      <div className="lbls" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {items.map(([key, text, color]) => (
          <span key={key} ref={(el) => void (labelEls.current[key] = el)} style={{ position: 'absolute', left: 0, top: 0, color, whiteSpace: 'nowrap', fontWeight: 700, textShadow: `0 0 6px ${props.colors.paper}, 0 0 2px ${props.colors.paper}` }}>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
