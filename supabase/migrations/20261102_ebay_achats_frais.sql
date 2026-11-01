-- « Mes achats » : total payé et frais supplémentaires (douane, taxes) déduits des totaux de la commande eBay.
alter table public.achats_membre add column if not exists total_paye numeric(12, 2);
alter table public.achats_membre add column if not exists autres_frais numeric(12, 2);
