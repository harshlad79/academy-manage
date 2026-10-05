import { env } from '$env/dynamic/private';

/** Simulation is opt-in. Product execution keeps the existing Mongo path. */
export function isSqliteSimulationMode(): boolean {
	return (env.SIMULATION_MODE ?? '').trim().toLowerCase() === 'sqlite';
}
