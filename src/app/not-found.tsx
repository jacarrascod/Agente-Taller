import { BotonEnlace } from "@/components/ui/Button";

export default function NoEncontrado() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <p className="dato text-sm text-acero">404</p>
      <h1 className="mt-2 text-2xl font-bold text-tinta">No encontramos esta página</h1>
      <p className="mt-3 text-sm text-acero">
        El enlace puede estar roto o el repuesto, la cita o la página que busca ya no existe. Pruebe desde el
        catálogo o pregúntele a Toño.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <BotonEnlace href="/repuestos">Ver repuestos</BotonEnlace>
        <BotonEnlace href="/" variante="contorno">
          Ir al inicio
        </BotonEnlace>
      </div>
    </div>
  );
}
