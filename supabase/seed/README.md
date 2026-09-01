# Local acceptance seed

`acceptance.sql` contains deterministic, synthetic fixtures only. Never place personal career data,
production credentials, or provider payloads in this directory. Reset the local project with
`pnpm db:reset`; migrations run before the seed.
