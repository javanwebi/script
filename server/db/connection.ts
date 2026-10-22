import pg from 'pg';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export const databaseEnabled=()=>process.env.DATA_BACKEND==='postgres';
export const adoptedSchema=()=>process.env.DATABASE_SCHEMA==='adopted';
export const databaseEnvironment=()=>process.env.DATABASE_ENV || 'development';
/** Deployment gate: keep the React/Vite interface bundled from source, while all mutable data is PostgreSQL-only. */
export function assertProductionDatabaseConfig(env:NodeJS.ProcessEnv=process.env){
 if(env.NODE_ENV!=='production')return;
 if(env.DATA_BACKEND!=='postgres')throw new Error('Production requires DATA_BACKEND=postgres; local-file mode is disabled.');
 if(env.DATABASE_SCHEMA!=='adopted')throw new Error('Production requires DATABASE_SCHEMA=adopted for the existing Supabase schema.');
 if(env.DATABASE_ENV!=='production')throw new Error('Production requires DATABASE_ENV=production.');
 if(!env.DATABASE_URL)throw new Error('Production requires a server-only DATABASE_URL.');
 if(env.DATABASE_SSL!=='require')throw new Error('Production requires DATABASE_SSL=require.');
}

let pool:pg.Pool|undefined;
export function database(){
 if(!databaseEnabled())throw new Error('PostgreSQL data backend is not enabled');
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required; local-file fallback is disabled in PostgreSQL mode');
 pool ||= new pg.Pool({connectionString:process.env.DATABASE_URL,max:8,idleTimeoutMillis:30000,connectionTimeoutMillis:10000,...(process.env.DATABASE_SSL==='require' ? {ssl:{rejectUnauthorized:true,ca:process.env.DATABASE_CA_CERT || readFileSync(join(process.cwd(),'certs','supabase-root-2021-ca.crt'),'utf8')}} : {})});
 return pool;
}
export type SqlClient=Pick<pg.PoolClient,'query'>;
export async function transaction<T>(run:(client:SqlClient)=>Promise<T>):Promise<T>{const client=await database().connect();try{await client.query('begin');const value=await run(client);await client.query('commit');return value;}catch(error){await client.query('rollback');throw error;}finally{client.release();}}
export async function closeDatabase(){await pool?.end();pool=undefined;}
