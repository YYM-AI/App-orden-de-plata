import { readFileSync } from 'node:fs';
import { Client } from 'pg';

export const HOSTED_REF = 'sfdazqyophgjehwlkhla';
export const HOSTED_ORIGIN = 'https://clymo-patrimonio-m2.familiameirovichhaic.chatgpt.site';

// Deliberately pinned to this disposable synthetic project. Never accept arbitrary targets.
export function hostedConfig() {
  const c = JSON.parse(readFileSync('.local/hosted-staging.json', 'utf8'));
  if (
    c.projectRef !== HOSTED_REF ||
    c.supabaseUrl !== `https://${HOSTED_REF}.supabase.co` ||
    c.dbHost !== 'aws-0-us-west-2.pooler.supabase.com' ||
    c.dbPort !== 5432 ||
    c.dbUser !== `postgres.${HOSTED_REF}` ||
    c.dbName !== 'postgres' ||
    !c.databasePassword ||
    !c.anonKey ||
    !c.serviceRoleKey
  )
    throw Error('Dedicated synthetic hosted configuration is missing or does not match.');
  return c as {
    projectRef: string;
    supabaseUrl: string;
    dbHost: string;
    dbPort: number;
    dbUser: string;
    dbName: string;
    databasePassword: string;
    anonKey: string;
    serviceRoleKey: string;
  };
}

export function hostedConnection() {
  const c = hostedConfig();
  return new Client({
    host: c.dbHost,
    port: c.dbPort,
    user: c.dbUser,
    database: c.dbName,
    password: c.databasePassword,
    ssl: { rejectUnauthorized: true, ca: readFileSync('.local/hosted-root-ca.crt', 'utf8') },
    connectionTimeoutMillis: 15000,
  });
}
