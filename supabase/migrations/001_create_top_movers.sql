-- Top movers table: holds exactly 10 rows (5 gainers + 5 losers).
-- The movers-sync job replaces all rows every ~90 seconds during market hours.

create table if not exists top_movers (
  id          bigint generated always as identity primary key,
  symbol      text    not null,
  price       numeric not null,
  change      numeric not null,
  percent_change numeric not null,
  side        text    not null check (side in ('gainer', 'loser')),
  rank        smallint not null check (rank between 1 and 5),
  updated_at  timestamptz not null default now(),

  constraint uq_top_movers_side_rank unique (side, rank)
);

create index if not exists idx_top_movers_side on top_movers (side);
