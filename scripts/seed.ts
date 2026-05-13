import mongoose from 'mongoose';
import 'dotenv/config';

import { Academy } from '../src/lib/server/models/academy';
import { AcademyMembership } from '../src/lib/server/models/academy-membership';
import { BankDeposit } from '../src/lib/server/models/bank-deposit';
import { Attendance } from '../src/lib/server/models/attendance';
import { AttendanceAuditLog } from '../src/lib/server/models/attendance-audit-log';
import { Course } from '../src/lib/server/models/course';
import { Enrollment } from '../src/lib/server/models/enrollment';
import { InvoiceLine } from '../src/lib/server/models/invoice-line';
import { MakeupSession } from '../src/lib/server/models/makeup-session';
import { ParentStudentLink } from '../src/lib/server/models/parent-student-link';
import { Payment } from '../src/lib/server/models/payment';
import { Student } from '../src/lib/server/models/student';
import { Teacher } from '../src/lib/server/models/teacher';

const academyId = new mongoose.Types.ObjectId(
	process.env.DEV_ACADEMY_ID ?? '507f1f77bcf86cd799439011'
);
/** 데모용 분원 — `testuser`·`superadmin` 멤버십으로 내비 학원 전환 시연 */
const academyIdB = new mongoose.Types.ObjectId(
	process.env.DEV_ACADEMY_SECOND_ID?.trim() || '507f1f77bcf86cd799439022'
);

const academyPair = { $in: [academyId, academyIdB] };

async function seed() {
	if (academyId.equals(academyIdB)) {
		console.error('DEV_ACADEMY_SECOND_ID 는 DEV_ACADEMY_ID 와 달라야 합니다.');
		process.exit(1);
	}

	await mongoose.connect(process.env.DB_URL!);
	console.log('Connected to DB');

	await AcademyMembership.deleteMany({ academyId: academyPair });
	await Academy.updateOne(
		{ _id: academyId },
		{ $set: { name: '데모 학원', status: 'active' } },
		{ upsert: true }
	);
	await Academy.updateOne(
		{ _id: academyIdB },
		{ $set: { name: '데모 학원 B (분원)', status: 'active' } },
		{ upsert: true }
	);
	await BankDeposit.deleteMany({ academyId: academyPair });
	await Payment.deleteMany({});
	await InvoiceLine.deleteMany({});
	await AttendanceAuditLog.deleteMany({});
	await Attendance.deleteMany({});
	await MakeupSession.deleteMany({});
	await ParentStudentLink.deleteMany({ academyId: academyPair });
	await Enrollment.deleteMany({});
	await Course.deleteMany({});
	await Teacher.deleteMany({});
	await Student.deleteMany({});

	const [t1, t2] = await Teacher.create([
		{ academyId, name: '박선생', subject: '수학' },
		{ academyId, name: '최선생', subject: '영어' }
	]);

	const [c1, c2] = await Course.insertMany([
		{ academyId, name: '수학기초', teacherId: t1._id },
		{ academyId, name: '영어회화', teacherId: t2._id }
	]);

	const [s1, s2] = await Student.insertMany([
		{ academyId, name: '김철수', grade: '고1' },
		{ academyId, name: '이영희', grade: '고2' }
	]);

	const ens = await Enrollment.insertMany([
		{ academyId, studentId: s1._id, courseId: c1._id },
		{ academyId, studentId: s1._id, courseId: c2._id },
		{ academyId, studentId: s2._id, courseId: c2._id }
	]);

	await InvoiceLine.create({
		academyId,
		enrollmentId: ens[0]._id,
		amountKrw: 120_000,
		description: '5월 수강료(샘플)',
		dueDate: '2026-05-31',
		status: 'open'
	});

	await BankDeposit.create({
		academyId,
		amountKrw: 120_000,
		depositedAt: new Date('2026-05-08T09:05:00+09:00'),
		memo: '김철수 학부모',
		externalRef: 'SEED-DEPOSIT-MAYFEE',
		status: 'unmatched'
	});

	const paidApril = await InvoiceLine.create({
		academyId,
		enrollmentId: ens[0]._id,
		amountKrw: 110_000,
		description: '4월 수강료(완납 샘플)',
		dueDate: '2026-04-30',
		status: 'paid',
		paidAt: new Date('2026-04-28T10:30:00+09:00')
	});

	await Payment.create({
		academyId,
		invoiceLineId: paidApril._id,
		amountKrw: paidApril.amountKrw,
		method: 'manual',
		recordedByUserId: 'testuser',
		paidAt: paidApril.paidAt!,
		note: '현금 완납'
	});

	await MakeupSession.create({
		academyId,
		enrollmentId: ens[0]._id,
		sessionDate: '2026-05-15',
		sessionTime: '15:00',
		description: '5월 보강(샘플)'
	});

	await Attendance.insertMany([
		{
			academyId,
			enrollmentId: ens[0]._id,
			sessionDate: '2026-05-09',
			status: 'present'
		},
		{
			academyId,
			enrollmentId: ens[0]._id,
			sessionDate: '2026-05-06',
			status: 'late',
			reason: '교통 지연'
		}
	]);

	/* —— 분원(데모 다학원 전환) 최소 데이터 —— */
	const [tb] = await Teacher.create([{ academyId: academyIdB, name: '정선생', subject: '국어' }]);
	const [cb] = await Course.insertMany([
		{ academyId: academyIdB, name: '국어심화', teacherId: tb._id }
	]);
	const [sb] = await Student.insertMany([{ academyId: academyIdB, name: '송민준', grade: '중3' }]);
	const [enb] = await Enrollment.insertMany([
		{ academyId: academyIdB, studentId: sb._id, courseId: cb._id }
	]);
	await InvoiceLine.create({
		academyId: academyIdB,
		enrollmentId: enb[0]._id,
		amountKrw: 95_000,
		description: '5월 수강료(분원 샘플)',
		dueDate: '2026-05-25',
		status: 'open'
	});

	await AcademyMembership.create([
		{
			userId: 'superadmin',
			academyId,
			role: 'super_admin'
		},
		{
			userId: 'testuser',
			academyId,
			role: 'academy_admin'
		},
		{
			userId: 'superadmin',
			academyId: academyIdB,
			role: 'super_admin'
		},
		{
			userId: 'testuser',
			academyId: academyIdB,
			role: 'academy_admin'
		}
	]);

	const parentUserId = 'parent-kim';
	await AcademyMembership.create({
		userId: parentUserId,
		academyId,
		role: 'parent'
	});
	await ParentStudentLink.create({
		academyId,
		parentUserId,
		studentId: s1._id
	});

	console.log(
		'Database seeded — 기본 학원 %s (데모 학원), 분원 %s (데모 학원 B). mock에서 testuser 로그인 시 내비「활성 학원」전환 가능.',
		academyId.toHexString(),
		academyIdB.toHexString()
	);
	await mongoose.disconnect();
}

seed();
