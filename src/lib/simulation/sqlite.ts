import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type SimulationRole = 'super_admin' | 'academy_admin' | 'office' | 'teacher' | 'parent';

export type SimulationUser = {
	id: string;
	name: string;
	email: string;
	role: SimulationRole;
	academyId: string;
	linkedTeacherId: string | null;
};

const DEFAULT_DB_PATH = resolve('.simulation/academy.sqlite');
let database: DatabaseSync | null = null;

function dbPath(): string {
	return process.env.SIMULATION_DB_PATH?.trim() || DEFAULT_DB_PATH;
}

function getDatabase(): DatabaseSync {
	if (database) return database;
	const path = dbPath();
	mkdirSync(dirname(path), { recursive: true });
	database = new DatabaseSync(path);
	database.exec('PRAGMA foreign_keys = ON;');
	database.exec(`
		CREATE TABLE IF NOT EXISTS academies (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active',
			trial_ends_at TEXT
		);
		CREATE TABLE IF NOT EXISTS memberships (
			user_id TEXT NOT NULL,
			academy_id TEXT NOT NULL REFERENCES academies(id),
			role TEXT NOT NULL,
			linked_teacher_id TEXT,
			PRIMARY KEY (user_id, academy_id)
		);
		CREATE TABLE IF NOT EXISTS academy_flags (
			academy_id TEXT PRIMARY KEY REFERENCES academies(id),
			billing_auto_import INTEGER NOT NULL,
			parent_portal_enabled INTEGER NOT NULL,
			communications_enabled INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS teachers (
			id TEXT PRIMARY KEY,
			academy_id TEXT NOT NULL REFERENCES academies(id),
			name TEXT NOT NULL,
			subject TEXT
		);
		CREATE TABLE IF NOT EXISTS students (
			id TEXT PRIMARY KEY,
			academy_id TEXT NOT NULL REFERENCES academies(id),
			name TEXT NOT NULL,
			grade TEXT,
			guardian_name TEXT,
			guardian_phone TEXT
		);
		CREATE TABLE IF NOT EXISTS courses (
			id TEXT PRIMARY KEY,
			academy_id TEXT NOT NULL REFERENCES academies(id),
			name TEXT NOT NULL,
			teacher_id TEXT
		);
		CREATE TABLE IF NOT EXISTS enrollments (
			id TEXT PRIMARY KEY,
			academy_id TEXT NOT NULL REFERENCES academies(id),
			student_id TEXT NOT NULL,
			course_id TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS invoices (
			id TEXT PRIMARY KEY,
			academy_id TEXT NOT NULL REFERENCES academies(id),
			enrollment_id TEXT,
			student_id TEXT NOT NULL,
			amount_krw INTEGER NOT NULL,
			status TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS announcements (
			id TEXT PRIMARY KEY,
			academy_id TEXT NOT NULL REFERENCES academies(id),
			title TEXT NOT NULL,
			body TEXT NOT NULL,
			created_by_user_id TEXT NOT NULL,
			created_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS attendance (
			enrollment_id TEXT NOT NULL,
			session_date TEXT NOT NULL,
			status TEXT NOT NULL,
			reason TEXT,
			PRIMARY KEY (enrollment_id, session_date)
		);
		CREATE TABLE IF NOT EXISTS makeup_sessions (
			id TEXT PRIMARY KEY,
			enrollment_id TEXT NOT NULL,
			session_date TEXT NOT NULL,
			session_time TEXT,
			description TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS leads (
			id TEXT PRIMARY KEY,
			academy_id TEXT NOT NULL REFERENCES academies(id),
			student_name TEXT NOT NULL,
			guardian_name TEXT NOT NULL,
			phone TEXT NOT NULL,
			memo TEXT,
			source TEXT NOT NULL,
			status TEXT NOT NULL,
			student_id TEXT,
			created_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS deposits (
			id TEXT PRIMARY KEY,
			academy_id TEXT NOT NULL,
			amount_krw INTEGER NOT NULL,
			deposited_at TEXT NOT NULL,
			memo TEXT,
			external_ref TEXT,
			status TEXT NOT NULL DEFAULT 'unmatched'
		);
		CREATE TABLE IF NOT EXISTS payments (
			id TEXT PRIMARY KEY,
			academy_id TEXT NOT NULL,
			invoice_id TEXT NOT NULL,
			amount_krw INTEGER NOT NULL,
			paid_at TEXT NOT NULL,
			method TEXT NOT NULL,
			recorded_by_user_id TEXT NOT NULL
		);
	`);
	try {
		database.exec('ALTER TABLE students ADD COLUMN guardian_name TEXT');
	} catch {
		/* existing schema */
	}
	try {
		database.exec('ALTER TABLE students ADD COLUMN guardian_phone TEXT');
	} catch {
		/* existing schema */
	}
	try {
		database.exec('ALTER TABLE invoices ADD COLUMN enrollment_id TEXT');
	} catch {
		/* existing schema */
	}
	return database;
}

export function ensureSimulationSeed(): void {
	const db = getDatabase();
	const academy = db.prepare('SELECT id FROM academies WHERE id = ?').get('academy-demo') as
		| { id: string }
		| undefined;
	if (academy) {
		db.prepare('INSERT OR IGNORE INTO users (id, name, email) VALUES (?, ?, ?)').run(
			'superadmin',
			'전체관리자(시뮬레이션)',
			'superadmin@example.com'
		);
		db.prepare(
			'INSERT OR IGNORE INTO memberships (user_id, academy_id, role, linked_teacher_id) VALUES (?, ?, ?, ?)'
		).run('superadmin', 'academy-demo', 'super_admin', null);
		return;
	}

	db.exec('BEGIN');
	try {
		db.prepare('INSERT INTO academies (id, name, status) VALUES (?, ?, ?)').run(
			'academy-demo',
			'시뮬레이션 학원',
			'active'
		);
		const user = db.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)');
		user.run('testuser', '테스트 관리자', 'test@example.com');
		user.run('superadmin', '전체관리자(시뮬레이션)', 'superadmin@example.com');
		user.run('teacher-demo', '시뮬레이션 강사', 'teacher@example.com');
		user.run('parent-kim', '김 학부모', 'parent-kim@example.com');
		const membership = db.prepare(
			'INSERT INTO memberships (user_id, academy_id, role, linked_teacher_id) VALUES (?, ?, ?, ?)'
		);
		membership.run('testuser', 'academy-demo', 'academy_admin', null);
		membership.run('superadmin', 'academy-demo', 'super_admin', null);
		membership.run('teacher-demo', 'academy-demo', 'teacher', 'teacher-demo');
		membership.run('parent-kim', 'academy-demo', 'parent', null);
		db.prepare('INSERT INTO teachers (id, academy_id, name, subject) VALUES (?, ?, ?, ?)').run(
			'teacher-demo',
			'academy-demo',
			'시뮬레이션 강사',
			'수학'
		);
		const student = db.prepare(
			'INSERT INTO students (id, academy_id, name, grade) VALUES (?, ?, ?, ?)'
		);
		student.run('student-1', 'academy-demo', '김학생', '중1');
		student.run('student-2', 'academy-demo', '이학생', '초6');
		db.prepare('INSERT INTO courses (id, academy_id, name, teacher_id) VALUES (?, ?, ?, ?)').run(
			'course-1',
			'academy-demo',
			'중등 수학',
			'teacher-demo'
		);
		db.prepare(
			'INSERT INTO enrollments (id, academy_id, student_id, course_id) VALUES (?, ?, ?, ?)'
		).run('enrollment-1', 'academy-demo', 'student-1', 'course-1');
		db.prepare(
			'INSERT INTO invoices (id, academy_id, enrollment_id, student_id, amount_krw, status) VALUES (?, ?, ?, ?, ?, ?)'
		).run('invoice-1', 'academy-demo', 'enrollment-1', 'student-1', 180000, 'open');
		db.exec('COMMIT');
	} catch (error) {
		db.exec('ROLLBACK');
		throw error;
	}
}

export function simulationUser(userId: string): SimulationUser | null {
	ensureSimulationSeed();
	const db = getDatabase();
	const row = db
		.prepare(
			`SELECT u.id, u.name, u.email, m.role, m.academy_id AS academyId,
					m.linked_teacher_id AS linkedTeacherId
			 FROM users u JOIN memberships m ON m.user_id = u.id
			 WHERE u.id = ? ORDER BY m.academy_id LIMIT 1`
		)
		.get(userId) as SimulationUser | undefined;
	return row ?? null;
}

export function simulationCanAccessCourse(userId: string, courseId: string): boolean {
	const user = simulationUser(userId);
	if (!user || user.role === 'parent') return false;
	if (user.role !== 'teacher') return true;
	return Boolean(
		getDatabase()
			.prepare('SELECT 1 FROM courses WHERE id = ? AND academy_id = ? AND teacher_id = ?')
			.get(courseId, user.academyId, user.linkedTeacherId)
	);
}

export function simulationCanAccessEnrollment(userId: string, enrollmentId: string): boolean {
	const user = simulationUser(userId);
	if (!user || user.role === 'parent') return false;
	if (user.role !== 'teacher')
		return Boolean(
			getDatabase()
				.prepare('SELECT 1 FROM enrollments WHERE id = ? AND academy_id = ?')
				.get(enrollmentId, user.academyId)
		);
	return Boolean(
		getDatabase()
			.prepare(
				'SELECT 1 FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.id = ? AND e.academy_id = ? AND c.teacher_id = ?'
			)
			.get(enrollmentId, user.academyId, user.linkedTeacherId)
	);
}

export function simulationDashboard(academyId: string) {
	ensureSimulationSeed();
	const db = getDatabase();
	const count = (table: string) =>
		(
			db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE academy_id = ?`).get(academyId) as {
				count: number;
			}
		)?.count ?? 0;
	const invoice = db
		.prepare(
			"SELECT COUNT(*) AS count, COALESCE(SUM(amount_krw), 0) AS total FROM invoices WHERE academy_id = ? AND status = 'open'"
		)
		.get(academyId) as { count: number; total: number };
	return {
		studentCount: count('students'),
		courseCount: count('courses'),
		enrollmentCount: count('enrollments'),
		openInvoiceCount: invoice.count,
		openInvoiceTotalKrw: invoice.total,
		unmatchedDepositCount: 0,
		makeupSessionCount: 0,
		teacherCount: count('teachers'),
		dbError: null as string | null
	};
}

export function simulationStudents(academyId: string, query: string) {
	ensureSimulationSeed();
	const db = getDatabase();
	const rows = (
		query
			? db
					.prepare(
						'SELECT id, name, grade FROM students WHERE academy_id = ? AND name LIKE ? ORDER BY name'
					)
					.all(academyId, `%${query}%`)
			: db
					.prepare('SELECT id, name, grade FROM students WHERE academy_id = ? ORDER BY name')
					.all(academyId)
	) as Array<{ id: string; name: string; grade: string | null }>;
	return rows;
}

export function simulationCreateStudent(name: string, grade?: string): void {
	ensureSimulationSeed();
	getDatabase()
		.prepare('INSERT INTO students (id, academy_id, name, grade) VALUES (?, ?, ?, ?)')
		.run(`student-${randomUUID()}`, 'academy-demo', name, grade || null);
}

export function simulationDeleteStudent(id: string): boolean {
	ensureSimulationSeed();
	const db = getDatabase();
	const enrolled = db
		.prepare('SELECT COUNT(*) AS count FROM enrollments WHERE academy_id = ? AND student_id = ?')
		.get('academy-demo', id) as { count: number };
	if (enrolled.count > 0) return false;
	const result = db
		.prepare('DELETE FROM students WHERE academy_id = ? AND id = ?')
		.run('academy-demo', id);
	return result.changes > 0;
}

export function simulationStudent(id: string) {
	ensureSimulationSeed();
	return getDatabase()
		.prepare(
			'SELECT id, name, grade, guardian_name AS guardianName, guardian_phone AS guardianPhone FROM students WHERE academy_id = ? AND id = ?'
		)
		.get('academy-demo', id) as
		| {
				id: string;
				name: string;
				grade: string | null;
				guardianName: string | null;
				guardianPhone: string | null;
		  }
		| undefined;
}

export function simulationUpdateStudent(
	id: string,
	name: string,
	grade: string | undefined,
	guardianName: string | undefined,
	guardianPhone: string | undefined
): boolean {
	ensureSimulationSeed();
	return (
		getDatabase()
			.prepare(
				'UPDATE students SET name = ?, grade = ?, guardian_name = ?, guardian_phone = ? WHERE academy_id = ? AND id = ?'
			)
			.run(name, grade || null, guardianName || null, guardianPhone || null, 'academy-demo', id)
			.changes > 0
	);
}

export function simulationTeachers(query = '') {
	ensureSimulationSeed();
	const db = getDatabase();
	return (
		query
			? db
					.prepare(
						'SELECT id, name, subject FROM teachers WHERE academy_id = ? AND name LIKE ? ORDER BY name'
					)
					.all('academy-demo', `%${query}%`)
			: db
					.prepare('SELECT id, name, subject FROM teachers WHERE academy_id = ? ORDER BY name')
					.all('academy-demo')
	) as Array<{ id: string; name: string; subject: string | null }>;
}

export function simulationCreateTeacher(name: string, subject?: string): void {
	ensureSimulationSeed();
	getDatabase()
		.prepare('INSERT INTO teachers (id, academy_id, name, subject) VALUES (?, ?, ?, ?)')
		.run(`teacher-${randomUUID()}`, 'academy-demo', name, subject || null);
}

export function simulationDeleteTeacher(id: string): boolean {
	ensureSimulationSeed();
	const db = getDatabase();
	const tied = db
		.prepare('SELECT COUNT(*) AS count FROM courses WHERE academy_id = ? AND teacher_id = ?')
		.get('academy-demo', id) as { count: number };
	if (tied.count > 0) return false;
	return (
		db.prepare('DELETE FROM teachers WHERE academy_id = ? AND id = ?').run('academy-demo', id)
			.changes > 0
	);
}

export function simulationTeacher(id: string) {
	ensureSimulationSeed();
	return getDatabase()
		.prepare('SELECT id, name, subject FROM teachers WHERE academy_id = ? AND id = ?')
		.get('academy-demo', id) as { id: string; name: string; subject: string | null } | undefined;
}

export function simulationUpdateTeacher(id: string, name: string, subject?: string): boolean {
	ensureSimulationSeed();
	return (
		getDatabase()
			.prepare('UPDATE teachers SET name = ?, subject = ? WHERE academy_id = ? AND id = ?')
			.run(name, subject || null, 'academy-demo', id).changes > 0
	);
}

export function simulationCourses(query = '') {
	ensureSimulationSeed();
	const db = getDatabase();
	const rows = (
		query
			? db
					.prepare(
						`SELECT c.id, c.name, c.teacher_id AS teacherId, COALESCE(t.name, '') AS teacherName
					 FROM courses c LEFT JOIN teachers t ON t.id = c.teacher_id
					 WHERE c.academy_id = ? AND c.name LIKE ? ORDER BY c.name`
					)
					.all('academy-demo', `%${query}%`)
			: db
					.prepare(
						`SELECT c.id, c.name, c.teacher_id AS teacherId, COALESCE(t.name, '') AS teacherName
					 FROM courses c LEFT JOIN teachers t ON t.id = c.teacher_id
					 WHERE c.academy_id = ? ORDER BY c.name`
					)
					.all('academy-demo')
	) as Array<{
		id: string;
		name: string;
		teacherId: string;
		teacherName: string;
	}>;
	return rows;
}

export function simulationCreateCourse(name: string, teacherId: string): boolean {
	ensureSimulationSeed();
	const db = getDatabase();
	const teacher = db
		.prepare('SELECT id FROM teachers WHERE academy_id = ? AND id = ?')
		.get('academy-demo', teacherId);
	if (!teacher) return false;
	db.prepare('INSERT INTO courses (id, academy_id, name, teacher_id) VALUES (?, ?, ?, ?)').run(
		`course-${randomUUID()}`,
		'academy-demo',
		name,
		teacherId
	);
	return true;
}

export function simulationDeleteCourse(id: string): boolean {
	ensureSimulationSeed();
	const db = getDatabase();
	const tied = db
		.prepare('SELECT COUNT(*) AS count FROM enrollments WHERE academy_id = ? AND course_id = ?')
		.get('academy-demo', id) as { count: number };
	if (tied.count > 0) return false;
	return (
		db.prepare('DELETE FROM courses WHERE academy_id = ? AND id = ?').run('academy-demo', id)
			.changes > 0
	);
}

export function simulationCourse(id: string) {
	ensureSimulationSeed();
	const db = getDatabase();
	return db
		.prepare(
			'SELECT id, name, teacher_id AS teacherId FROM courses WHERE academy_id = ? AND id = ?'
		)
		.get('academy-demo', id) as { id: string; name: string; teacherId: string } | undefined;
}

export function simulationUpdateCourse(id: string, name: string, teacherId: string): boolean {
	ensureSimulationSeed();
	const db = getDatabase();
	if (
		!db
			.prepare('SELECT id FROM teachers WHERE academy_id = ? AND id = ?')
			.get('academy-demo', teacherId)
	)
		return false;
	return (
		db
			.prepare('UPDATE courses SET name = ?, teacher_id = ? WHERE academy_id = ? AND id = ?')
			.run(name, teacherId, 'academy-demo', id).changes > 0
	);
}

export function simulationEnrollments(studentId = '', courseId = '') {
	ensureSimulationSeed();
	const db = getDatabase();
	const students = db
		.prepare('SELECT id, name FROM students WHERE academy_id = ? ORDER BY name')
		.all('academy-demo') as Array<{ id: string; name: string }>;
	const courses = db
		.prepare('SELECT id, name FROM courses WHERE academy_id = ? ORDER BY name')
		.all('academy-demo') as Array<{ id: string; name: string }>;
	const rows = db
		.prepare(
			`SELECT e.id, e.student_id AS studentId, s.name AS studentName, e.course_id AS courseId, c.name AS courseName
		FROM enrollments e JOIN students s ON s.id = e.student_id JOIN courses c ON c.id = e.course_id
		WHERE e.academy_id = ? AND (? = '' OR e.student_id = ?) AND (? = '' OR e.course_id = ?)
		ORDER BY e.id DESC`
		)
		.all('academy-demo', studentId, studentId, courseId, courseId) as Array<{
		id: string;
		studentId: string;
		studentName: string;
		courseId: string;
		courseName: string;
	}>;
	return { students, courses, enrollments: rows };
}

export function simulationCreateEnrollment(
	studentId: string,
	courseId: string
): 'ok' | 'missing-student' | 'missing-course' | 'duplicate' {
	ensureSimulationSeed();
	const db = getDatabase();
	if (
		!db
			.prepare('SELECT id FROM students WHERE academy_id = ? AND id = ?')
			.get('academy-demo', studentId)
	)
		return 'missing-student';
	if (
		!db
			.prepare('SELECT id FROM courses WHERE academy_id = ? AND id = ?')
			.get('academy-demo', courseId)
	)
		return 'missing-course';
	if (
		db
			.prepare(
				'SELECT id FROM enrollments WHERE academy_id = ? AND student_id = ? AND course_id = ?'
			)
			.get('academy-demo', studentId, courseId)
	)
		return 'duplicate';
	db.prepare(
		'INSERT INTO enrollments (id, academy_id, student_id, course_id) VALUES (?, ?, ?, ?)'
	).run(`enrollment-${randomUUID()}`, 'academy-demo', studentId, courseId);
	return 'ok';
}

export function simulationDeleteEnrollment(id: string): boolean {
	ensureSimulationSeed();
	return (
		getDatabase()
			.prepare('DELETE FROM enrollments WHERE academy_id = ? AND id = ?')
			.run('academy-demo', id).changes > 0
	);
}

export function simulationSettingsData() {
	ensureSimulationSeed();
	return {
		academyName: '시뮬레이션 학원',
		academyStatus: 'active',
		notice: null as string | null,
		noticeMessage: null as string | null,
		inviteRows: [],
		inviteAcceptOrigin: 'http://localhost:5173',
		teacherOptions: [{ id: 'teacher-demo', name: '시뮬레이션 강사', subject: '수학' }],
		rows: [
			{ userId: 'testuser', role: 'academy_admin', linkedTeacherId: null, linkedTeacherName: null },
			{
				userId: 'teacher-demo',
				role: 'teacher',
				linkedTeacherId: 'teacher-demo',
				linkedTeacherName: '시뮬레이션 강사'
			},
			{ userId: 'parent-kim', role: 'parent', linkedTeacherId: null, linkedTeacherName: null }
		]
	};
}

export function simulationAnnouncements() {
	ensureSimulationSeed();
	return getDatabase()
		.prepare(
			'SELECT id, title, body, created_by_user_id AS createdByUserId, created_at AS createdAt FROM announcements WHERE academy_id = ? ORDER BY created_at DESC LIMIT 20'
		)
		.all('academy-demo') as Array<{
		id: string;
		title: string;
		body: string;
		createdByUserId: string;
		createdAt: string;
	}>;
}

export function simulationCreateAnnouncement(title: string, body: string, userId: string): void {
	ensureSimulationSeed();
	getDatabase()
		.prepare(
			'INSERT INTO announcements (id, academy_id, title, body, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.run(
			`announcement-${randomUUID()}`,
			'academy-demo',
			title,
			body,
			userId,
			new Date().toISOString()
		);
}

export function simulationDeleteAnnouncement(id: string): boolean {
	ensureSimulationSeed();
	return (
		getDatabase()
			.prepare('DELETE FROM announcements WHERE academy_id = ? AND id = ?')
			.run('academy-demo', id).changes > 0
	);
}

export function simulationAttendanceData(courseId = '', sessionDate = '') {
	ensureSimulationSeed();
	const db = getDatabase();
	const courses = db
		.prepare('SELECT id, name FROM courses WHERE academy_id = ? ORDER BY name')
		.all('academy-demo') as Array<{ id: string; name: string }>;
	const selected =
		courseId && courses.some((c) => c.id === courseId) ? courseId : (courses[0]?.id ?? '');
	const rows = db
		.prepare(
			`SELECT e.id AS enrollmentId, s.name AS studentName, COALESCE(a.status, 'present') AS status, COALESCE(a.reason, '') AS reason
		FROM enrollments e JOIN students s ON s.id = e.student_id LEFT JOIN attendance a ON a.enrollment_id = e.id AND a.session_date = ?
		WHERE e.academy_id = ? AND e.course_id = ? ORDER BY s.name`
		)
		.all(sessionDate, 'academy-demo', selected) as Array<{
		enrollmentId: string;
		studentName: string;
		status: 'present' | 'absent' | 'late' | 'excused';
		reason: string;
	}>;
	return { courses, selectedCourseId: selected, rows, auditTrail: [] };
}

export function simulationSaveAttendance(
	courseId: string,
	sessionDate: string,
	values: Array<{ enrollmentId: string; status: string; reason: string }>
): boolean {
	ensureSimulationSeed();
	const db = getDatabase();
	for (const value of values) {
		if (
			!db
				.prepare('SELECT id FROM enrollments WHERE academy_id = ? AND id = ? AND course_id = ?')
				.get('academy-demo', value.enrollmentId, courseId)
		)
			return false;
		db.prepare(
			'INSERT INTO attendance (enrollment_id, session_date, status, reason) VALUES (?, ?, ?, ?) ON CONFLICT(enrollment_id, session_date) DO UPDATE SET status = excluded.status, reason = excluded.reason'
		).run(value.enrollmentId, sessionDate, value.status, value.reason || null);
	}
	return true;
}

export function simulationMakeupData(courseId = '') {
	ensureSimulationSeed();
	const db = getDatabase();
	const courses = db
		.prepare('SELECT id, name FROM courses WHERE academy_id = ? ORDER BY name')
		.all('academy-demo') as Array<{ id: string; name: string }>;
	const selected = courseId && courses.some((c) => c.id === courseId) ? courseId : '';
	const enrollmentOptions = db
		.prepare(
			`SELECT e.id AS id, s.name || ' · ' || c.name AS label FROM enrollments e JOIN students s ON s.id = e.student_id JOIN courses c ON c.id = e.course_id WHERE e.academy_id = ? AND (? = '' OR e.course_id = ?) ORDER BY label`
		)
		.all('academy-demo', selected, selected) as Array<{ id: string; label: string }>;
	const rows = db
		.prepare(
			`SELECT m.id, m.session_date AS sessionDate, m.session_time AS sessionTime, m.description, s.name AS studentName, c.name AS courseName FROM makeup_sessions m JOIN enrollments e ON e.id = m.enrollment_id JOIN students s ON s.id = e.student_id JOIN courses c ON c.id = e.course_id WHERE e.academy_id = ? AND (? = '' OR e.course_id = ?) ORDER BY m.session_date DESC`
		)
		.all('academy-demo', selected, selected) as Array<{
		id: string;
		sessionDate: string;
		sessionTime: string | null;
		description: string;
		studentName: string;
		courseName: string;
	}>;
	return { rows, courses, courseFilterId: courseId, enrollmentOptions };
}

export function simulationCreateMakeup(
	enrollmentId: string,
	sessionDate: string,
	sessionTime: string,
	description: string
): boolean {
	ensureSimulationSeed();
	const db = getDatabase();
	if (
		!db
			.prepare('SELECT id FROM enrollments WHERE academy_id = ? AND id = ?')
			.get('academy-demo', enrollmentId)
	)
		return false;
	db.prepare(
		'INSERT INTO makeup_sessions (id, enrollment_id, session_date, session_time, description) VALUES (?, ?, ?, ?, ?)'
	).run(`makeup-${randomUUID()}`, enrollmentId, sessionDate, sessionTime || null, description);
	return true;
}

export function simulationDeleteMakeup(id: string): boolean {
	ensureSimulationSeed();
	return getDatabase().prepare('DELETE FROM makeup_sessions WHERE id = ?').run(id).changes > 0;
}

export function simulationLeads(statusFilter = '') {
	ensureSimulationSeed();
	return getDatabase()
		.prepare(
			`SELECT id, student_name AS studentName, guardian_name AS guardianName, phone, memo, source, status, student_id AS studentIdHex, created_at AS createdAt FROM leads WHERE academy_id = ? AND (? = '' OR status = ?) ORDER BY created_at DESC LIMIT 200`
		)
		.all('academy-demo', statusFilter, statusFilter) as Array<{
		id: string;
		studentName: string;
		guardianName: string;
		phone: string;
		memo: string | null;
		source: 'web' | 'staff';
		status: 'new' | 'contacted' | 'waitlisted' | 'converted' | 'closed';
		studentIdHex: string | null;
		convertedAt: string | null;
		enrolledAt: string | null;
		createdAt: string;
	}>;
}

export function simulationLead(id: string) {
	return simulationLeads('').find((lead) => lead.id === id);
}

export function simulationCreateLead(
	studentName: string,
	guardianName: string,
	phone: string,
	memo: string
): void {
	ensureSimulationSeed();
	getDatabase()
		.prepare(
			'INSERT INTO leads (id, academy_id, student_name, guardian_name, phone, memo, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
		)
		.run(
			`lead-${randomUUID()}`,
			'academy-demo',
			studentName,
			guardianName,
			phone,
			memo || null,
			'staff',
			'new',
			new Date().toISOString()
		);
}

export function simulationUpdateLeadStatus(id: string, status: string): boolean {
	ensureSimulationSeed();
	return (
		getDatabase()
			.prepare('UPDATE leads SET status = ? WHERE academy_id = ? AND id = ?')
			.run(status, 'academy-demo', id).changes > 0
	);
}

export function simulationConvertLead(id: string): string | null {
	ensureSimulationSeed();
	const db = getDatabase();
	const lead = db
		.prepare(
			'SELECT student_name AS name, student_id AS studentId FROM leads WHERE academy_id = ? AND id = ?'
		)
		.get('academy-demo', id) as { name: string; studentId: string | null } | undefined;
	if (!lead) return null;
	if (lead.studentId) return lead.studentId;
	const studentId = `student-${randomUUID()}`;
	db.prepare('INSERT INTO students (id, academy_id, name, grade) VALUES (?, ?, ?, ?)').run(
		studentId,
		'academy-demo',
		lead.name,
		null
	);
	db.prepare('UPDATE leads SET status = ?, student_id = ? WHERE academy_id = ? AND id = ?').run(
		'converted',
		studentId,
		'academy-demo',
		id
	);
	return studentId;
}

export function simulationPaymentsData(statusFilter = '') {
	ensureSimulationSeed();
	const db = getDatabase();
	const enrollments = db
		.prepare(
			`SELECT e.id, s.name || ' · ' || c.name AS label FROM enrollments e JOIN students s ON s.id = e.student_id JOIN courses c ON c.id = e.course_id WHERE e.academy_id = ? ORDER BY label`
		)
		.all('academy-demo') as Array<{ id: string; label: string }>;
	const rows = db
		.prepare(
			`SELECT i.id, i.amount_krw AS amountKrw, i.status, i.student_id AS studentId, s.name AS studentName, c.name AS courseName, '수강료' AS description, date('now') AS dueDate, NULL AS paidAt FROM invoices i JOIN students s ON s.id = i.student_id LEFT JOIN enrollments e ON e.id = i.enrollment_id LEFT JOIN courses c ON c.id = e.course_id WHERE i.academy_id = ? AND (? = '' OR i.status = ?) ORDER BY i.id DESC`
		)
		.all('academy-demo', statusFilter, statusFilter) as Array<{
		id: string;
		amountKrw: number;
		status: 'open' | 'paid';
		studentId: string;
		studentName: string;
		courseName: string;
		description: string;
		dueDate: string;
		paidAt: string | null;
	}>;
	const matchingLines = rows.filter((r) => r.status === 'open');
	const pendingDeposits = db
		.prepare(
			'SELECT id, amount_krw AS amountKrw, deposited_at AS depositedAt, memo, external_ref AS externalRef FROM deposits WHERE academy_id = ? AND status = ? ORDER BY deposited_at DESC'
		)
		.all('academy-demo', 'unmatched') as Array<{
		id: string;
		amountKrw: number;
		depositedAt: string;
		memo: string | null;
		externalRef: string | null;
	}>;
	const recentPayments = db
		.prepare(
			`SELECT p.id, p.amount_krw AS amountKrw, p.method, p.paid_at AS paidAt, p.recorded_by_user_id AS recordedByUserId, s.name AS studentName, c.name AS courseName, '수강료' AS description, NULL AS externalRef FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN students s ON s.id = i.student_id LEFT JOIN enrollments e ON e.id = i.enrollment_id LEFT JOIN courses c ON c.id = e.course_id WHERE p.academy_id = ? ORDER BY p.paid_at DESC`
		)
		.all('academy-demo') as Array<{
		id: string;
		amountKrw: number;
		method: string;
		paidAt: string;
		recordedByUserId: string;
		studentName: string;
		courseName: string;
		description: string;
		externalRef: string | null;
	}>;
	return { rows, matchingLines, pendingDeposits, recentPayments, enrollments };
}

export type SimulationCourseRevenueRow = {
	courseId: string;
	courseName: string;
	teacherName: string;
	paidCount: number;
	paidTotalKrw: number;
	openCount: number;
	openTotalKrw: number;
};

export function simulationCourseRevenueData(
	month: string,
	role: SimulationRole,
	linkedTeacherId: string | null
): { rows: SimulationCourseRevenueRow[]; scopeWarning: string | null } {
	ensureSimulationSeed();
	if (role === 'teacher' && !linkedTeacherId) {
		return {
			rows: [],
			scopeWarning:
				'강사 계정에 담당 클래스 연결(linkedTeacherId)이 없습니다. 관리자에게 문의하세요.'
		};
	}
	const db = getDatabase();
	const teacherClause = role === 'teacher' ? ' AND c.teacher_id = ?' : '';
	const params = role === 'teacher' ? ['academy-demo', linkedTeacherId] : ['academy-demo'];
	const rows = db
		.prepare(
			`SELECT c.id AS courseId, c.name AS courseName, COALESCE(t.name, '—') AS teacherName,
					COALESCE(SUM(CASE WHEN p.id IS NOT NULL AND substr(p.paid_at, 1, 7) = ? THEN 1 ELSE 0 END), 0) AS paidCount,
					COALESCE(SUM(CASE WHEN p.id IS NOT NULL AND substr(p.paid_at, 1, 7) = ? THEN p.amount_krw ELSE 0 END), 0) AS paidTotalKrw,
					COALESCE(SUM(CASE WHEN i.status = 'open' THEN 1 ELSE 0 END), 0) AS openCount,
					COALESCE(SUM(CASE WHEN i.status = 'open' THEN i.amount_krw ELSE 0 END), 0) AS openTotalKrw
			 FROM courses c
			 LEFT JOIN teachers t ON t.id = c.teacher_id
			 LEFT JOIN enrollments e ON e.course_id = c.id AND e.academy_id = c.academy_id
				 LEFT JOIN invoices i ON i.enrollment_id = e.id AND i.academy_id = c.academy_id
			 LEFT JOIN payments p ON p.invoice_id = i.id AND p.academy_id = c.academy_id
			 WHERE c.academy_id = ?${teacherClause}
			 GROUP BY c.id, c.name, t.name
			 HAVING paidCount > 0 OR openCount > 0
			 ORDER BY c.name`
		)
		.all(month, month, ...params) as SimulationCourseRevenueRow[];
	return { rows, scopeWarning: null };
}

export function simulationCreateInvoice(enrollmentId: string, amountKrw: number): boolean {
	ensureSimulationSeed();
	const db = getDatabase();
	const enrollment = db
		.prepare('SELECT id, student_id AS studentId FROM enrollments WHERE academy_id = ? AND id = ?')
		.get('academy-demo', enrollmentId) as { id: string; studentId: string } | undefined;
	if (!enrollment) return false;
	db.prepare(
		'INSERT INTO invoices (id, academy_id, enrollment_id, student_id, amount_krw, status) VALUES (?, ?, ?, ?, ?, ?)'
	).run(
		`invoice-${randomUUID()}`,
		'academy-demo',
		enrollment.id,
		enrollment.studentId,
		amountKrw,
		'open'
	);
	return true;
}

export function simulationMarkInvoicePaid(id: string, userId: string): 'ok' | 'missing' | 'paid' {
	ensureSimulationSeed();
	const db = getDatabase();
	const invoice = db
		.prepare('SELECT amount_krw AS amountKrw, status FROM invoices WHERE academy_id = ? AND id = ?')
		.get('academy-demo', id) as { amountKrw: number; status: string } | undefined;
	if (!invoice) return 'missing';
	if (invoice.status === 'paid') return 'paid';
	const now = new Date().toISOString();
	db.prepare('UPDATE invoices SET status = ? WHERE academy_id = ? AND id = ?').run(
		'paid',
		'academy-demo',
		id
	);
	db.prepare(
		'INSERT INTO payments (id, academy_id, invoice_id, amount_krw, paid_at, method, recorded_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
	).run(`payment-${randomUUID()}`, 'academy-demo', id, invoice.amountKrw, now, 'manual', userId);
	return 'ok';
}

export function simulationCreateDeposit(
	amountKrw: number,
	depositedAt: string,
	memo: string
): void {
	ensureSimulationSeed();
	getDatabase()
		.prepare(
			'INSERT INTO deposits (id, academy_id, amount_krw, deposited_at, memo, status) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.run(
			`deposit-${randomUUID()}`,
			'academy-demo',
			amountKrw,
			depositedAt,
			memo || null,
			'unmatched'
		);
}

export function simulationAcademyMembersData(academyIdHex: string) {
	ensureSimulationSeed();
	const db = getDatabase();
	const academy = db
		.prepare('SELECT name, status FROM academies WHERE id = ?')
		.get(academyIdHex) as { name: string; status: string } | undefined;
	if (!academy) return null;
	return {
		academyIdHex,
		academyName: academy.name,
		academyStatus: academy.status,
		notice: null as string | null,
		noticeMessage: null as string | null,
		inviteRows: [],
		inviteRoles: ['academy_admin', 'office', 'teacher', 'parent'] as const,
		inviteAcceptOrigin: 'http://localhost:5173',
		teacherOptions: db
			.prepare('SELECT id, name, subject FROM teachers WHERE academy_id = ? ORDER BY name')
			.all(academyIdHex) as Array<{ id: string; name: string; subject: string | null }>,
		rows: db
			.prepare(
				`SELECT m.user_id AS userId, m.role, m.linked_teacher_id AS linkedTeacherId,
			t.name AS linkedTeacherName FROM memberships m LEFT JOIN teachers t
			ON t.id = m.linked_teacher_id AND t.academy_id = m.academy_id
			WHERE m.academy_id = ? ORDER BY m.user_id`
			)
			.all(academyIdHex) as Array<{
			userId: string;
			role: string;
			linkedTeacherId: string | null;
			linkedTeacherName: string | null;
		}>
	};
}

export function simulationPortalData() {
	ensureSimulationSeed();
	const announcements = simulationAnnouncements().map((row) => ({
		id: row.id,
		title: row.title,
		body: row.body,
		createdAt: row.createdAt
	}));
	return {
		academyDisplayName: '시뮬레이션 학원',
		academyOperationalStatus: 'active' as const,
		parentPortalEnabled: true,
		communicationsEnabled: true,
		announcements,
		students: [],
		openInvoiceLines: [],
		earliestOpenDueDate: null,
		paymentHistory: [],
		recentAttendance: [],
		recentAttendanceCap: 48,
		paymentHistoryCap: 40
	};
}

export function simulationAcademiesData() {
	ensureSimulationSeed();
	const db = getDatabase();
	const academies = db
		.prepare(
			`SELECT a.id, a.name, a.status, a.trial_ends_at AS trialEndsAt,
			COALESCE(f.billing_auto_import, 1) AS billingAutoImport,
			COALESCE(f.parent_portal_enabled, 1) AS parentPortalEnabled,
			COALESCE(f.communications_enabled, 1) AS communicationsEnabled
			FROM academies a LEFT JOIN academy_flags f ON f.academy_id = a.id ORDER BY a.name`
		)
		.all() as Array<{
		id: string;
		name: string;
		status: string;
		trialEndsAt: string | null;
		billingAutoImport: number;
		parentPortalEnabled: number;
		communicationsEnabled: number;
	}>;
	return {
		defaultAcademyIdHex: 'academy-demo',
		rows: academies.map((academy) => ({
			id: academy.id,
			name: academy.name,
			status: academy.status,
			trialEndsAt: academy.trialEndsAt,
			billingAutoImport: Boolean(academy.billingAutoImport),
			parentPortalEnabled: Boolean(academy.parentPortalEnabled),
			communicationsEnabled: Boolean(academy.communicationsEnabled)
		})),
		dbError: null as string | null
	};
}

export function simulationCreateAcademy(name: string): void {
	ensureSimulationSeed();
	const db = getDatabase();
	const id = `academy-${randomUUID()}`;
	db.prepare('INSERT INTO academies (id, name, status) VALUES (?, ?, ?)').run(id, name, 'active');
	db.prepare(
		'INSERT INTO memberships (user_id, academy_id, role, linked_teacher_id) VALUES (?, ?, ?, ?)'
	).run('superadmin', id, 'super_admin', null);
}

export function simulationUpdateAcademyStatus(id: string, status: 'active' | 'inactive'): boolean {
	ensureSimulationSeed();
	return (
		getDatabase().prepare('UPDATE academies SET status = ? WHERE id = ?').run(status, id).changes >
		0
	);
}

export function simulationUpdateAcademyFlags(
	id: string,
	billingAutoImport: boolean,
	parentPortalEnabled: boolean,
	communicationsEnabled: boolean
): boolean {
	ensureSimulationSeed();
	const db = getDatabase();
	if (!db.prepare('SELECT id FROM academies WHERE id = ?').get(id)) return false;
	db.prepare(
		`INSERT INTO academy_flags (academy_id, billing_auto_import, parent_portal_enabled, communications_enabled)
		VALUES (?, ?, ?, ?) ON CONFLICT(academy_id) DO UPDATE SET
		billing_auto_import = excluded.billing_auto_import,
		parent_portal_enabled = excluded.parent_portal_enabled,
		communications_enabled = excluded.communications_enabled`
	).run(id, Number(billingAutoImport), Number(parentPortalEnabled), Number(communicationsEnabled));
	return true;
}

export function simulationMutateMember(
	academyId: string,
	action: 'add' | 'remove' | 'link',
	userId: string,
	role: string,
	teacherId: string
): string | null {
	const data = simulationAcademyMembersData(academyId);
	if (!data) return '학원을 찾을 수 없습니다.';
	if (!userId || userId.length > 128) return '사용자 ID(128자 이내)를 입력하세요.';
	const db = getDatabase();
	const member = data.rows.find((r) => r.userId === userId);
	if (action === 'remove') {
		if (!member) return '멤버십을 찾을 수 없습니다.';
		if (
			member.role === 'super_admin' &&
			data.rows.filter((r) => r.role === 'super_admin').length <= 1
		)
			return '이 학원의 마지막 전체관리자(super_admin) 멤버십은 삭제할 수 없습니다.';
		db.prepare('DELETE FROM memberships WHERE academy_id = ? AND user_id = ?').run(
			academyId,
			userId
		);
		return null;
	}
	if (action === 'add') {
		if (!['academy_admin', 'office', 'teacher', 'parent'].includes(role))
			return '허용되지 않은 역할입니다.';
		if (member) return '이미 이 학원에 대한 멤버십이 있습니다.';
	} else if (member?.role !== 'teacher') {
		return '강사(teacher) 멤버십만 강사 프로필을 연결할 수 있습니다.';
	}
	const linkedId = action === 'link' || role === 'teacher' ? teacherId : '';
	if (linkedId) {
		if (!data.teacherOptions.some((t) => t.id === linkedId))
			return '이 학원의 강사 프로필이 아닙니다.';
		if (data.rows.some((r) => r.userId !== userId && r.linkedTeacherId === linkedId))
			return '이미 다른 멤버십에 연결된 강사입니다.';
	}
	if (action === 'add') {
		db.prepare(
			'INSERT INTO memberships (user_id, academy_id, role, linked_teacher_id) VALUES (?, ?, ?, ?)'
		).run(userId, academyId, role, linkedId || null);
	} else {
		db.prepare(
			'UPDATE memberships SET linked_teacher_id = ? WHERE academy_id = ? AND user_id = ?'
		).run(linkedId || null, academyId, userId);
	}
	return null;
}

export function simulationInquiriesData(
	statusFilter: 'new' | 'contacted' | 'trial' | 'approved' | 'rejected' | null
) {
	return {
		statusFilter,
		statusOptions: ['new', 'contacted', 'trial', 'approved', 'rejected'] as const,
		inviteAcceptOrigin: 'http://localhost:5173',
		notice: null as string | null,
		noticeMessage: null as string | null,
		rows: []
	};
}
