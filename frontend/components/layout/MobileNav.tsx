"use client";

import { useRef } from "react";
import { Menu, X } from "lucide-react";
import { Marca, NavLinks } from "@/components/layout/NavLinks";

/**
 * Menu em gaveta para telas menores que 1024px (UI-03).
 * O <dialog> nativo cuida de Esc, foco preso e fundo; aqui só fechamos ao
 * clicar fora (no fundo) e ao escolher um link.
 */
export function MobileNav() {
  const ref = useRef<HTMLDialogElement>(null);

  function abrir() {
    ref.current?.showModal();
    ref.current?.querySelector<HTMLAnchorElement>("nav a")?.focus();
  }

  function fechar() {
    ref.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
        Menu
      </button>
      <dialog
        ref={ref}
        aria-label="Menu de navegação"
        onClick={(e) => e.target === ref.current && fechar()}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-sidebar p-0 backdrop:bg-black/50"
      >
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="flex items-start justify-between">
            <Marca />
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar menu"
              className="m-3 rounded-md p-1.5 text-sidebar-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <NavLinks onNavigate={fechar} />
        </div>
      </dialog>
    </>
  );
}
