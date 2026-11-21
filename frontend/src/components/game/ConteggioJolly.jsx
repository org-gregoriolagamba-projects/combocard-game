/**
 * ConteggioJolly Component
 *
 * The seconds left while a player chooses the card for the jolly and the draws
 * are paused. It is only a picture of the time: the screen decides what happens
 * when the time is over. It is hidden from screen readers so it does not read
 * a number every second; the sentence around it says what is going on.
 *
 * The server sends the moment the pause ends. The count never shows more than
 * the time to choose of the game (`durata`, from its settings), so a clock that is
 * off cannot show an absurd time. Without `durata` there is no cap and no number is invented.
 */

import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

function ConteggioJolly({ scadenza, durata, className = "" }) {
  // Start from the real time of the first paint: place a `key` on the moment so a new pause starts again
  const [ora, setOra] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setOra(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const restanti = Math.max(0, Math.ceil((scadenza - ora) / 1000));
  const secondi = durata === undefined ? restanti : Math.min(durata, restanti);

  return (
    <span aria-hidden="true" className={`tabular-nums ${className}`}>
      {secondi} s
    </span>
  );
}

ConteggioJolly.propTypes = {
  scadenza: PropTypes.number.isRequired,
  durata: PropTypes.number,
  className: PropTypes.string,
};

export default ConteggioJolly;
