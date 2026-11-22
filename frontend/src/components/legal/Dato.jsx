/**
 * Dato
 *
 * A value of the legal texts that comes from the configuration. A value that is not set yet is
 * shown as "[da indicare]", well marked, so that nobody publishes the text without it.
 */

import React from "react";
import PropTypes from "prop-types";

function Dato({ valore }) {
  if (valore === null || valore === undefined || valore === "") {
    return (
      <mark data-testid="da-indicare" className="rounded bg-oro px-1 font-bold text-inchiostro-900">
        [da indicare]
      </mark>
    );
  }
  return <>{valore}</>;
}

Dato.propTypes = {
  valore: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default Dato;
