/**
 * LegalLayout
 *
 * The page of the privacy notice and of the terms of use: a full screen with the title, the version
 * of the texts and the button that goes back to the screen the player came from. Public: it works
 * without an account.
 */

import React from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";
import { ArrowLeft } from "lucide-react";
import { closeLegal, showLegal } from "../../store/slices/uiSlice";
import { LEGALE } from "../../config/legale";
import Dato from "./Dato";

export function Sezione({ titolo, children }) {
  return (
    <section className="space-y-2">
      <h2 className="titolo text-lg text-testo">{titolo}</h2>
      {children}
    </section>
  );
}

Sezione.propTypes = {
  titolo: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

/** A link to the other legal text: it keeps the screen to go back to */
export function LinkTesto({ a, children }) {
  const dispatch = useDispatch();
  return (
    <button
      type="button"
      onClick={() => dispatch(showLegal(a))}
      className="min-h-[44px] rounded-lg font-bold text-testo underline decoration-2 underline-offset-4"
    >
      {children}
    </button>
  );
}

LinkTesto.propTypes = {
  a: PropTypes.oneOf(["informativa", "termini"]).isRequired,
  children: PropTypes.node.isRequired,
};

function LegalLayout({ titolo, children }) {
  const dispatch = useDispatch();

  return (
    <div className="min-h-[100dvh] tavolo p-4 max-[359px]:p-2">
      <div className="mx-auto max-w-2xl space-y-4">
        <button
          type="button"
          onClick={() => dispatch(closeLegal())}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-linea-forte bg-notte-700 px-4 font-bold text-testo transition hover:bg-notte-600"
        >
          <ArrowLeft size={20} aria-hidden="true" />
          Indietro
        </button>

        <article className="superficie space-y-5 p-5 text-testo-2 max-[359px]:p-3 sm:p-6 [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed">
          <header>
            <h1 className="titolo text-3xl text-testo [overflow-wrap:anywhere]">{titolo}</h1>
            <p className="mt-1 text-sm">
              Versione {LEGALE.versione} · in vigore dal <Dato valore={LEGALE.vigenteDal} />
            </p>
          </header>
          {children}
        </article>
      </div>
    </div>
  );
}

LegalLayout.propTypes = {
  titolo: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

export default LegalLayout;
