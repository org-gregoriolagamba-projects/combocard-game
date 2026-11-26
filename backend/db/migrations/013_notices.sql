-- Avvisi e manutenzione: due tabelle da una riga sola, come game_settings.
--
-- announcement: l'avviso a tutti i giocatori, uno alla volta. Pubblicarne uno nuovo sostituisce il
-- precedente e alza la versione (chi ha chiuso un avviso non lo rivede finché la versione non cambia);
-- ritirarlo lo disattiva e lascia la versione. Inizio e fine sono facoltativi.
--
-- maintenance: la modalità manutenzione, accesa o spenta, con il messaggio e l'ora prevista di fine
-- (solo informativa: non spegne nulla da sola).

CREATE TABLE announcement (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version     INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT false,
  message     TEXT NOT NULL DEFAULT '',
  severity    TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'importante')),
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ,
  updated_by  TEXT,
  CONSTRAINT announcement_ends_after_starts CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

INSERT INTO announcement (id) VALUES (1);

CREATE TABLE maintenance (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active      BOOLEAN NOT NULL DEFAULT false,
  message     TEXT NOT NULL DEFAULT '',
  ends_at     TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ,
  updated_by  TEXT
);

INSERT INTO maintenance (id) VALUES (1);
