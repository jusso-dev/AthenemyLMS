# Supabase Setup

1. Create a Supabase project.
2. Copy the pooled connection string to `DATABASE_URL`.
3. Copy the direct connection string to `DIRECT_URL`.
4. Generate Prisma Client:

```bash
npm run db:generate
```

5. Run migrations:

```bash
npm run db:migrate
```

## Connection Notes

Use the pooled port for runtime queries and the direct port for migrations. Keep `pgbouncer=true` on the pooled runtime URL.
