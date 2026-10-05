import { afterAll, beforeAll, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as sim from './sqlite';

const directory = mkdtempSync(join(tmpdir(), 'academy-platform-'));
beforeAll(() => {
	process.env.SIMULATION_DB_PATH = join(directory, 'test.sqlite');
});
afterAll(() => {
	delete process.env.SIMULATION_DB_PATH;
	rmSync(directory, { recursive: true, force: true });
});

test('new academy member view reflects its own name, state and memberships', () => {
	sim.simulationCreateAcademy('Platform verification');
	const academy = sim
		.simulationAcademiesData()
		.rows.find((r) => r.name === 'Platform verification')!;
	sim.simulationUpdateAcademyStatus(academy.id, 'inactive');
	const data = sim.simulationAcademyMembersData(academy.id)!;
	expect(data.academyName).toBe('Platform verification');
	expect(data.academyStatus).toBe('inactive');
	expect(data.rows.map((r) => r.userId)).toEqual(['superadmin']);
	expect(data.teacherOptions).toEqual([]);
});

test('saving flags survives reload without reactivating an inactive academy', () => {
	const academy = sim
		.simulationAcademiesData()
		.rows.find((r) => r.name === 'Platform verification')!;
	expect(sim.simulationUpdateAcademyFlags(academy.id, false, true, false)).toBe(true);
	expect(sim.simulationAcademiesData().rows.find((r) => r.id === academy.id)).toMatchObject({
		status: 'inactive',
		billingAutoImport: false,
		parentPortalEnabled: true,
		communicationsEnabled: false
	});
	expect(sim.simulationUpdateAcademyFlags('missing', true, true, true)).toBe(false);
});

test('member mutations stay within the selected academy and protect its last superadmin', () => {
	const academy = sim
		.simulationAcademiesData()
		.rows.find((r) => r.name === 'Platform verification')!;
	expect(sim.simulationMutateMember(academy.id, 'add', 'lane-member', 'office', '')).toBeNull();
	expect(sim.simulationAcademyMembersData(academy.id)!.rows.map((r) => r.userId)).toContain(
		'lane-member'
	);
	expect(sim.simulationAcademyMembersData('academy-demo')!.rows.map((r) => r.userId)).not.toContain(
		'lane-member'
	);
	expect(sim.simulationMutateMember(academy.id, 'add', 'lane-member', 'office', '')).toBeTruthy();
	expect(sim.simulationMutateMember(academy.id, 'remove', 'superadmin', 'office', '')).toBeTruthy();
	expect(
		sim.simulationMutateMember(academy.id, 'link', 'lane-member', '', 'teacher-demo')
	).toBeTruthy();
	expect(sim.simulationMutateMember(academy.id, 'remove', 'lane-member', 'office', '')).toBeNull();
	expect(sim.simulationAcademyMembersData(academy.id)!.rows.map((r) => r.userId)).toEqual([
		'superadmin'
	]);
});
