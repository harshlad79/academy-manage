import { beforeAll, afterAll, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as sim from './sqlite';
const directory = mkdtempSync(join(tmpdir(), 'academy-review-'));
beforeAll(() => {
	process.env.SIMULATION_DB_PATH = join(directory, 'test.sqlite');
});
afterAll(() => {
	delete process.env.SIMULATION_DB_PATH;
	rmSync(directory, { recursive: true, force: true });
});

test('conversion returns the existing student on retry', () => {
	sim.simulationCreateLead('Retry', 'Guardian', '01012345678', '');
	const lead = sim.simulationLeads().find((l) => l.studentName === 'Retry')!;
	const id = sim.simulationConvertLead(lead.id);
	expect(sim.simulationConvertLead(lead.id)).toBe(id);
});
test('portal announcements reflect published and deleted state', () => {
	sim.simulationCreateAnnouncement('Published', 'Body', 'testuser');
	expect(sim.simulationPortalData().announcements).toHaveLength(1);
	sim.simulationDeleteAnnouncement(sim.simulationAnnouncements()[0].id);
	expect(sim.simulationPortalData().announcements).toHaveLength(0);
});
test('invoice revenue belongs only to the purchased course', () => {
	sim.simulationCreateCourse('Other course', 'teacher-demo');
	const course = sim.simulationCourses().find((c) => c.name === 'Other course')!;
	sim.simulationCreateEnrollment('student-1', course.id);
	const enrollment = sim.simulationEnrollments('student-1', course.id).enrollments[0];
	sim.simulationCreateInvoice(enrollment.id, 12345);
	const invoice = sim.simulationPaymentsData().rows.find((i) => i.amountKrw === 12345)!;
	expect(invoice.courseName).toBe('Other course');
	const report = sim.simulationCourseRevenueData('2026-09', 'academy_admin', null);
	expect(report.rows.find((r) => r.courseId === course.id)?.openTotalKrw).toBe(12345);
	expect(report.rows.find((r) => r.courseId === 'course-1')?.openTotalKrw).toBe(180000);
});
