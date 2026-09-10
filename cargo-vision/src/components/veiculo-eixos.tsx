import type { CargaEixo } from "@/lib/packing";

interface Props {
  comprimento_cm: number;
  eixos: CargaEixo[];
}

// Vista lateral simplificada do veículo com indicação de peso por eixo.
export function VeiculoEixos({ comprimento_cm, eixos }: Props) {
  if (eixos.length === 0) {
    return (
      <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-500">
        Veículo sem configuração de eixos.
      </div>
    );
  }

  // Define a faixa horizontal que precisamos desenhar: do eixo mais à esquerda até o fim da carroceria.
  const minPos = Math.min(0, ...eixos.map((e) => e.posicao_cm));
  const maxPos = Math.max(comprimento_cm, ...eixos.map((e) => e.posicao_cm));
  const totalRange = maxPos - minPos;
  const VB_W = 800;
  const VB_H = 200;
  const padX = 30;
  const drawW = VB_W - padX * 2;
  const toX = (cm: number) => padX + ((cm - minPos) / totalRange) * drawW;

  const cargaX0 = toX(0);
  const cargaX1 = toX(comprimento_cm);
  const cargaY = 60;
  const cargaH = 70;
  const chassiY = cargaY + cargaH;
  const wheelY = chassiY + 18;

  return (
    <div className="rounded-md border bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-700">Distribuição de peso por eixo (CONTRAN)</p>
        <p className="text-[10px] text-slate-400">Vista lateral esquemática</p>
      </div>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-44 w-full">
        {/* Carroceria */}
        <rect
          x={cargaX0}
          y={cargaY}
          width={cargaX1 - cargaX0}
          height={cargaH}
          fill="#e2e8f0"
          stroke="#94a3b8"
          strokeWidth={1.5}
          rx={4}
        />
        <text x={(cargaX0 + cargaX1) / 2} y={cargaY + cargaH / 2 + 4} textAnchor="middle" fontSize={11} fill="#64748b">
          Carroceria · {comprimento_cm} cm
        </text>

        {/* Chassi */}
        <line
          x1={toX(minPos)}
          x2={toX(maxPos)}
          y1={chassiY}
          y2={chassiY}
          stroke="#475569"
          strokeWidth={3}
        />

        {/* Eixos */}
        {eixos.map((e, i) => {
          const cx = toX(e.posicao_cm);
          const cor = e.excede ? "#dc2626" : "#0f172a";
          const pct = Math.round((e.peso_kg / e.limite_kg) * 100);
          return (
            <g key={i}>
              {/* Roda */}
              <circle cx={cx} cy={wheelY} r={12} fill={cor} />
              <circle cx={cx} cy={wheelY} r={5} fill="#fff" />
              {/* Etiqueta */}
              <rect
                x={cx - 60}
                y={wheelY + 18}
                width={120}
                height={42}
                rx={4}
                fill={e.excede ? "#fef2f2" : "#f8fafc"}
                stroke={cor}
                strokeWidth={1}
              />
              <text x={cx} y={wheelY + 32} textAnchor="middle" fontSize={10} fontWeight={600} fill={cor}>
                {e.nome}
              </text>
              <text x={cx} y={wheelY + 46} textAnchor="middle" fontSize={10} fill={cor}>
                {e.peso_kg.toLocaleString("pt-BR")} / {e.limite_kg.toLocaleString("pt-BR")} kg
              </text>
              <text x={cx} y={wheelY + 58} textAnchor="middle" fontSize={9} fill={cor}>
                {pct}% {e.excede ? "— EXCEDE" : ""}
              </text>
            </g>
          );
        })}
      </svg>
      {eixos.some((e) => e.excede) && (
        <p className="mt-2 text-xs font-semibold text-red-600">
          ⚠ Há eixo(s) com peso acima do limite legal — redistribua a carga.
        </p>
      )}
    </div>
  );
}
