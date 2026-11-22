-- Accettazione dei termini d'uso: ogni giocatore accetta, alla registrazione o al primo accesso dopo
-- la pubblicazione dei testi, i termini d'uso (e dichiara di aver letto l'informativa sulla privacy).
-- Si salvano la data e la versione dei testi accettati: se i testi cambiano in modo importante la
-- versione cambia e tutti accettano di nuovo.
--
-- NULL = non ancora accettato. I giocatori già esistenti partono da NULL e accettano al prossimo
-- accesso. Le due colonne restano anche quando l'account viene eliminato (il nome è anonimizzato).

ALTER TABLE players ADD COLUMN terms_accepted_at TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN terms_version TEXT;
