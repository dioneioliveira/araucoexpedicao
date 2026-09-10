import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Edges, Grid, Text } from "@react-three/drei";
import { Suspense, useRef, useState } from "react";
import { CONTAINER_40HC, type ItemPosicionado } from "@/types/logistica";

interface Props {
  itens: ItemPosicionado[];
  selectedUid?: string | null;
  onSelect?: (uid: string | null) => void;
  onMove?: (uid: string, x_cm: number, y_cm: number) => void;
  container?: { comprimento_cm: number; largura_cm: number; altura_cm: number };
}

function cm(v: number) {
  return v / 100;
}

// Escolhe preto ou branco conforme a luminância da cor da caixa (máximo contraste).
function corTexto(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111827" : "#ffffff";
}

function ItemBox({
  item,
  selected,
  draggable,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  dragging,
}: {
  item: ItemPosicionado;
  selected: boolean;
  draggable: boolean;
  onSelect?: (uid: string) => void;
  onDragStart: (uid: string, hit: { x: number; z: number }) => void;
  onDragMove: (e: ThreeEvent<PointerEvent>) => void;
  onDragEnd: (e: ThreeEvent<PointerEvent>) => void;
  dragging: boolean;
}) {
  const dx = cm(item.dx);
  const dy = cm(item.dy);
  const dz = cm(item.dz);
  const cx = cm(item.x) + dx / 2;
  const cy = cm(item.y) + dy / 2;
  const cz = cm(item.z) + dz / 2;
  // Texto: apenas o código (SKU), dimensionado para caber dentro da face do lote.
  const etiqueta = item.material.sku?.trim() || item.material.nome;
  // largura útil da face (X) e altura útil (Z), com margem de 10%.
  const larguraUtil = dx * 0.9;
  const alturaUtil = dz * 0.8;
  // ~0.6 de largura por caractere no fator de fonte usado pelo troika.
  const labelSize = Math.max(
    0.04,
    Math.min(alturaUtil, larguraUtil / Math.max(1, etiqueta.length * 0.62)),
  );

  const textColor = corTexto(item.material.cor);
  return (
    <group position={[cx, cz, cy]}>
      <mesh
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(item.uid);
        }}
        onPointerDown={(e) => {
          if (!draggable || !selected) return;
          e.stopPropagation();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          onDragStart(item.uid, { x: e.point.x, z: e.point.z });
        }}
        onPointerMove={dragging ? onDragMove : undefined}
        onPointerUp={dragging ? onDragEnd : undefined}
      >
        <boxGeometry args={[dx, dz, dy]} />
        <meshStandardMaterial
          color={item.material.cor}
          roughness={0.6}
          metalness={0.1}
          emissive={selected ? "#fbbf24" : "#000000"}
          emissiveIntensity={selected ? 0.45 : 0}
        />
        <Edges color={selected ? "#f59e0b" : "#1f2937"} threshold={15} />
      </mesh>
      {/* Etiqueta (SKU) nas faces laterais (frente/trás no eixo Y do container) */}
      {[1, -1].map((s) => (
        <group key={s} position={[0, 0, (dy / 2 + 0.002) * s]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
          <Text
            position={[0, 0, 0]}
            fontSize={labelSize}
            color={textColor}
            outlineWidth={labelSize * 0.06}
            outlineColor={textColor === "#ffffff" ? "#000000" : "#ffffff"}
            anchorX="center"
            anchorY="middle"
            maxWidth={dx * 0.95}
            fontWeight={700}
          >
            {etiqueta}
          </Text>
        </group>
      ))}
    </group>
  );
}

function ContainerBox({ L, W, H }: { L: number; W: number; H: number }) {
  return (
    <mesh position={[L / 2, H / 2, W / 2]}>
      <boxGeometry args={[L, H, W]} />
      <meshStandardMaterial color="#60a5fa" transparent opacity={0.1} depthWrite={false} />
      <Edges color="#2563eb" threshold={1} />
    </mesh>
  );
}

export function CenaContainer({ itens, selectedUid, onSelect, onMove, container }: Props) {
  const dims = container ?? CONTAINER_40HC;
  const L = cm(dims.comprimento_cm);
  const W = cm(dims.largura_cm);
  const H = cm(dims.altura_cm);

  // estado de drag (ref para não re-renderizar a cada move)
  const dragRef = useRef<{ uid: string; offX: number; offZ: number } | null>(null);
  const [draggingUid, setDraggingUid] = useState<string | null>(null);

  function startDrag(uid: string, hit: { x: number; z: number }) {
    const it = itens.find((i) => i.uid === uid);
    if (!it) return;
    // posição central do item em coordenadas locais do grupo (origem no canto)
    const cxLocal = cm(it.x) + cm(it.dx) / 2;
    const cyLocal = cm(it.y) + cm(it.dy) / 2;
    // world = local - L/2 (no eixo X) e local - W/2 (no eixo Z do three)
    const cxWorld = cxLocal - L / 2;
    const czWorld = cyLocal - W / 2;
    dragRef.current = {
      uid,
      offX: hit.x - cxWorld,
      offZ: hit.z - czWorld,
    };
    setDraggingUid(uid);
  }

  function moveDrag(e: ThreeEvent<PointerEvent>) {
    const d = dragRef.current;
    if (!d || !onMove) return;
    const it = itens.find((i) => i.uid === d.uid);
    if (!it) return;
    const wx = e.point.x - d.offX;
    const wz = e.point.z - d.offZ;
    const cxLocal = wx + L / 2;
    const cyLocal = wz + W / 2;
    const newXcm = cxLocal * 100 - it.dx / 2;
    const newYcm = cyLocal * 100 - it.dy / 2;
    onMove(d.uid, newXcm, newYcm);
  }

  function endDrag(e: ThreeEvent<PointerEvent>) {
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      /* noop */
    }
    dragRef.current = null;
    setDraggingUid(null);
  }

  return (
    <Canvas
      shadows
      gl={{ preserveDrawingBuffer: true }}
      camera={{ position: [L * 1.4, H * 1.6, W * 3], fov: 35 }}
      style={{ width: "100%", height: "100%", background: "#f8fafc" }}
      onPointerMissed={() => onSelect?.(null)}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[15, 20, 10]} intensity={1.1} castShadow />
        <directionalLight position={[-10, 10, -5]} intensity={0.4} />
        <group position={[-L / 2, 0, -W / 2]}>
          <Grid
            args={[40, 40]}
            position={[L / 2, -0.001, W / 2]}
            cellColor="#cbd5e1"
            sectionColor="#94a3b8"
            fadeDistance={60}
            infiniteGrid={false}
          />
          <ContainerBox L={L} W={W} H={H} />
          {itens.map((it) => (
            <ItemBox
              key={it.uid}
              item={it}
              selected={selectedUid === it.uid}
              draggable={!!onMove}
              dragging={draggingUid === it.uid}
              onSelect={onSelect}
              onDragStart={startDrag}
              onDragMove={moveDrag}
              onDragEnd={endDrag}
            />
          ))}
        </group>
        <OrbitControls
          enableDamping
          enabled={draggingUid === null}
          target={[0, H / 4, 0]}
        />
      </Suspense>
    </Canvas>
  );
}

export default CenaContainer;
