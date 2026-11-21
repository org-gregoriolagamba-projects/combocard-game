-- Parametri di gioco che l'admin può cambiare: una sola riga, con i valori di oggi come predefiniti.
--
-- I CHECK ripetono gli intervalli di src/config/gameSettings.js: un valore fuori intervallo è
-- rifiutato anche da chi scrive nel database senza passare dal server. Le partite non leggono questa
-- tabella mentre si giocano: ognuna porta con sé la copia dei valori al momento della creazione.

CREATE TABLE game_settings (
  id                      INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_players             INTEGER NOT NULL DEFAULT 2     CHECK (min_players BETWEEN 2 AND 10),
  max_players             INTEGER NOT NULL DEFAULT 10    CHECK (max_players BETWEEN 2 AND 20),
  required_credits        INTEGER NOT NULL DEFAULT 100   CHECK (required_credits BETWEEN 1 AND 10000),
  jolly_hold_seconds      INTEGER NOT NULL DEFAULT 30    CHECK (jolly_hold_seconds BETWEEN 10 AND 120),
  jolly_max_declarations  INTEGER NOT NULL DEFAULT 3     CHECK (jolly_max_declarations BETWEEN 1 AND 10),
  draw_cooldown_seconds   INTEGER NOT NULL DEFAULT 8     CHECK (draw_cooldown_seconds BETWEEN 3 AND 30),
  updated_at              TIMESTAMPTZ,
  updated_by              TEXT,
  CONSTRAINT game_settings_max_not_below_min CHECK (max_players >= min_players)
);

INSERT INTO game_settings (id) VALUES (1);
