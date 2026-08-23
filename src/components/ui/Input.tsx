import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

export function Etiqueta({ className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`mb-1 block text-sm font-medium text-tinta ${className}`} {...props} />;
}

export function Entrada({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-[2px] border border-filete bg-white px-3 py-2 text-sm text-tinta placeholder:text-acero focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo-toyota ${className}`}
      {...props}
    />
  );
}

export function CampoFormulario({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Etiqueta htmlFor={htmlFor}>{label}</Etiqueta>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-rojo-toyota" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
