import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Material } from "@/types/logistica";

interface Props {
  materiais: Material[];
  value?: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export function MaterialCombobox({ materiais, value, onChange, placeholder = "Selecionar ou digitar…", className }: Props) {
  const [open, setOpen] = useState(false);
  const selected = materiais.find((m) => m.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-auto min-h-10 w-full justify-between whitespace-normal py-2 text-left font-normal", className)}
        >
          {selected ? (
            <span className="flex flex-1 items-start gap-2">
              <span className="mt-1 inline-block h-3 w-3 flex-shrink-0 rounded" style={{ background: selected.cor }} />
              <span className="flex flex-col">
                <span className="break-words leading-tight">{selected.nome}</span>
                {selected.sku && <span className="break-words text-xs leading-tight text-slate-500">{selected.sku}</span>}
              </span>
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(value, search) => {
            // value é o id; precisamos buscar por nome/sku
            const m = materiais.find((x) => x.id === value);
            if (!m) return 0;
            const txt = `${m.nome} ${m.sku ?? ""}`.toLowerCase();
            return txt.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Digite o material…" />
          <CommandList>
            <CommandEmpty>Nenhum material encontrado.</CommandEmpty>
            <CommandGroup>
              {materiais.map((m) => (
                <CommandItem
                  className="items-start"
                  key={m.id}
                  value={m.id}
                  onSelect={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === m.id ? "opacity-100" : "opacity-0")} />
                  <span className="inline-block h-3 w-3 flex-shrink-0 rounded" style={{ background: m.cor }} />
                  <span className="ml-2 break-words">{m.nome}</span>
                  {m.sku && <span className="ml-2 break-words text-xs text-slate-400">· {m.sku}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
