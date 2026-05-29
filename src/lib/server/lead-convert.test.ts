import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

import { convertLead, LeadConvertError } from './lead-convert';

const mocks = vi.hoisted(() => ({
	leadFindById: vi.fn(),
	studentCreate: vi.fn(),
	studentFindById: vi.fn()
}));

vi.mock('./models/lead', () => ({
	Lead: {
		findById: (...args: unknown[]) => mocks.leadFindById(...args)
	}
}));

vi.mock('./models/student', () => ({
	Student: {
		create: (...args: unknown[]) => mocks.studentCreate(...args),
		findById: (...args: unknown[]) => mocks.studentFindById(...args)
	}
}));

type MockLead = {
	_id: Types.ObjectId;
	academyId: Types.ObjectId;
	studentName: string;
	guardianName: string;
	phone: string;
	status: string;
	studentId?: Types.ObjectId;
	convertedAt?: Date;
	save: ReturnType<typeof vi.fn>;
};

function makeLead(overrides: Partial<MockLead> = {}): MockLead {
	const academyId = new Types.ObjectId();
	return {
		_id: new Types.ObjectId(),
		academyId,
		studentName: '김학생',
		guardianName: '김보호',
		phone: '01012345678',
		status: 'contacted',
		save: vi.fn().mockResolvedValue(undefined),
		...overrides
	};
}

describe('convertLead', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates student from lead and marks lead converted', async () => {
		const academyId = new Types.ObjectId();
		const leadId = new Types.ObjectId();
		const studentId = new Types.ObjectId();
		const lead = makeLead({ _id: leadId, academyId });

		mocks.leadFindById.mockResolvedValue(lead);
		mocks.studentCreate.mockResolvedValue({
			_id: studentId,
			academyId,
			name: '김학생',
			guardianName: '김보호',
			guardianPhone: '01012345678'
		});

		const result = await convertLead({ leadId, academyId });

		expect(mocks.studentCreate).toHaveBeenCalledWith({
			academyId,
			name: '김학생',
			guardianName: '김보호',
			guardianPhone: '01012345678'
		});
		expect(lead.studentId).toEqual(studentId);
		expect(lead.status).toBe('converted');
		expect(lead.convertedAt).toBeInstanceOf(Date);
		expect(lead.save).toHaveBeenCalledOnce();
		expect(result.student._id).toEqual(studentId);
		expect(result.lead).toBe(lead);
	});

	it('returns existing student when lead already has studentId (idempotent)', async () => {
		const academyId = new Types.ObjectId();
		const leadId = new Types.ObjectId();
		const studentId = new Types.ObjectId();
		const convertedAt = new Date('2026-05-01T00:00:00Z');
		const lead = makeLead({
			_id: leadId,
			academyId,
			status: 'converted',
			studentId,
			convertedAt
		});
		const existingStudent = {
			_id: studentId,
			academyId,
			name: '김학생',
			guardianName: '김보호',
			guardianPhone: '01012345678'
		};

		mocks.leadFindById.mockResolvedValue(lead);
		mocks.studentFindById.mockResolvedValue(existingStudent);

		const result = await convertLead({ leadId, academyId });

		expect(mocks.studentCreate).not.toHaveBeenCalled();
		expect(lead.save).not.toHaveBeenCalled();
		expect(mocks.studentFindById).toHaveBeenCalledWith(studentId);
		expect(result.student).toBe(existingStudent);
		expect(result.lead).toBe(lead);
	});

	it('rejects when lead academyId does not match', async () => {
		const lead = makeLead();
		mocks.leadFindById.mockResolvedValue(lead);

		await expect(
			convertLead({ leadId: lead._id, academyId: new Types.ObjectId() })
		).rejects.toMatchObject({
			code: 'lead_academy_mismatch'
		} satisfies Partial<LeadConvertError>);
		expect(mocks.studentCreate).not.toHaveBeenCalled();
	});

	it('rejects when lead is not found', async () => {
		mocks.leadFindById.mockResolvedValue(null);

		await expect(
			convertLead({ leadId: new Types.ObjectId(), academyId: new Types.ObjectId() })
		).rejects.toMatchObject({
			code: 'lead_not_found'
		} satisfies Partial<LeadConvertError>);
		expect(mocks.studentCreate).not.toHaveBeenCalled();
	});
});
