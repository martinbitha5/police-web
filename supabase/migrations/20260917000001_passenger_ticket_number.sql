-- Identité d'un passager dans un vol : son billet électronique.
--
-- Constat terrain (ET70 du 16/09/2026 : 122 lignes pour 112 passagers) : quand
-- le comptoir change un siège, Sabre réédite le boarding pass avec un nouveau
-- siège, souvent un nouveau n° de séquence, et parfois sans les étiquettes
-- bagage. Rescanné au check-in, il créait une deuxième ligne : la clé
-- (flight_id, pnr, seat) ne reconnaît pas le passager, et le PNR seul ne suffit
-- pas (une réservation est partagée par plusieurs voyageurs) ; le nom non plus
-- (tronqué à 20 caractères, deux voyageurs d'une même réservation peuvent le
-- partager, cf. ET70 du 14/09 : deux billets, deux bagages, même nom).
--
-- Le billet électronique (code numérique compagnie + n° de document, 13
-- chiffres, section conditionnelle du BCBP) est le seul champ stable à travers
-- ces rééditions. L'API le lit désormais et met à jour la ligne existante au
-- lieu d'en créer une. Colonne nullable : les lignes antérieures et les
-- boarding pass sans section conditionnelle restent identifiés par
-- (pnr, nom) en repli.
--
-- Pas d'index unique pour l'instant : les doublons historiques existent encore
-- en base et la colonne n'est pas remplie rétroactivement. À poser après
-- nettoyage. La contrainte (flight_id, pnr, seat) est conservée.

alter table public.passengers
  add column if not exists ticket_number text;

comment on column public.passengers.ticket_number is
  'Billet électronique (13 chiffres : code numérique compagnie + n° de document). Identité du passager dans le vol, stable à travers les rééditions du boarding pass.';

create index if not exists passengers_flight_ticket_idx
  on public.passengers (flight_id, ticket_number)
  where ticket_number is not null;
