create table if not exists admin_config (
  key text primary key,
  value text not null,
  description text,
  updated_at date
);

insert into admin_config (key, value, description, updated_at)
values ('breakeven_fator_conversao', '1.12045', 'Fator de conversão cents/lb → R$/saca (0.022046 × 50.802)', current_date)
on conflict (key) do nothing;
