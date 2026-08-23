import { Insignia } from "../ui/Badge";
import type { EstadoStock } from "@/types/dominio";

const TEXTO: Record<EstadoStock, string> = {
  disponible: "Disponible",
  ultimas_unidades: "Últimas unidades",
  agotado: "Agotado",
};

// "Agotado" va en gris, no en rojo: el rojo es la acción de comprar, y usarlo
// para la mala noticia envía señales cruzadas. SPEC.md §13.1
const TONO: Record<EstadoStock, "verde" | "ambar" | "gris"> = {
  disponible: "verde",
  ultimas_unidades: "ambar",
  agotado: "gris",
};

export function StockBadge({ estado }: { estado: EstadoStock }) {
  return <Insignia tono={TONO[estado]}>{TEXTO[estado]}</Insignia>;
}
