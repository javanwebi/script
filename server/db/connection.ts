import pg from 'pg';
export const databaseEnabled=()=>process.env.DATA_BACKEND==='postgres';
export const adoptedSchema=()=>process.env.DATABASE_SCHEMA==='adopted';
export const databaseEnvironment=()=>process.env.DATABASE_ENV || 'development';
let pool:pg.Pool|undefined;
export function database(){
 if(!databaseEnabled())throw new Error('PostgreSQL data backend is not enabled');
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required; local-file fallback is disabled in PostgreSQL mode');
 pool ||= new pg.Pool({connectionString:process.env.DATABASE_URL,max:8,idleTimeoutMillis:30000,connectionTimeoutMillis:10000,...(process.env.DATABASE_SSL==='require' ? {ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA_CERT ? {ca:process.env.DATABASE_CA_CERT} : {})}} : {})});
 return pool;
}
export type SqlClient=Pick<pg.PoolClient,'query'>;
export async function transaction<T>(run:(client:SqlClient)=>Promise<T>):Promise<T>{const client=await database().connect();try{await client.query('begin');const value=await run(client);await client.query('commit');return value;}catch(error){await client.query('rollback');throw error;}finally{client.release();}}
export async function closeDatabase(){await pool?.end();pool=undefined;}
