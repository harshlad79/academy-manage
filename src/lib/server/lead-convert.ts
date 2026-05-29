import type { Types } from 'mongoose';

import { Lead, type LeadDoc } from './models/lead';
import { Student, type StudentDoc } from './models/student';

export type LeadConvertErrorCode = 'lead_not_found' | 'lead_academy_mismatch' | 'student_not_found';

export class LeadConvertError extends Error {
	constructor(
		message: string,
		readonly code: LeadConvertErrorCode
	) {
		super(message);
		this.name = 'LeadConvertError';
	}
}

export type ConvertLeadResult = {
	student: StudentDoc & { _id: Types.ObjectId };
	lead: LeadDoc & { _id: Types.ObjectId };
};

export async function convertLead(options: {
	leadId: Types.ObjectId;
	academyId: Types.ObjectId;
}): Promise<ConvertLeadResult> {
	const lead = await Lead.findById(options.leadId);
	if (!lead) {
		throw new LeadConvertError('상담·대기 건을 찾을 수 없습니다.', 'lead_not_found');
	}
	if (!lead.academyId.equals(options.academyId)) {
		throw new LeadConvertError('다른 학원의 상담·대기 건입니다.', 'lead_academy_mismatch');
	}

	if (lead.studentId) {
		const student = await Student.findById(lead.studentId);
		if (!student) {
			throw new LeadConvertError('연결된 학생을 찾을 수 없습니다.', 'student_not_found');
		}
		return {
			student: student as StudentDoc & { _id: Types.ObjectId },
			lead: lead as LeadDoc & { _id: Types.ObjectId }
		};
	}

	const student = (await Student.create({
		academyId: options.academyId,
		name: lead.studentName,
		guardianName: lead.guardianName,
		guardianPhone: lead.phone
	})) as StudentDoc & { _id: Types.ObjectId };

	const now = new Date();
	lead.studentId = student._id;
	lead.convertedAt = now;
	lead.status = 'converted';
	await lead.save();

	return {
		student,
		lead: lead as LeadDoc & { _id: Types.ObjectId }
	};
}
