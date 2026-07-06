-- Install attribution — best guess of what drove each app install.
-- Run this ONCE in the Supabase SQL editor. Then look at ONE table:
--     select * from install_report;
--
-- For each install we take the most-recent web tap (same phone type) in the 30
-- minutes before it. That tap tells us the mode, theme, and which promo they used.

create or replace view install_report as
select
  coalesce(best.game_mode, '(unknown)') as mode,
  best.round                            as round,
  coalesce(best.theme_slug, '(none)')   as theme,
  coalesce(best.banner_id, '(none)')    as which_promo,
  count(*)                              as installs
from installs_log i
left join lateral (
  select pc.*
  from promo_clicks pc
  where pc.created_at <= i.created_at
    and pc.created_at >  i.created_at - interval '30 minutes'
    and (i.platform not in ('android','ios') or pc.platform = i.platform)
  order by pc.created_at desc
  limit 1
) best on true
group by 1, 2, 3, 4
order by installs desc;
