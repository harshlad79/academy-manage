import { Types } from 'mongoose';
import { env } from '$env/dynamic/private';

/** 시드·로컬 목록 화면에서 쓰는 기본 학원 ID(PR: 멤버십으로 대체 예정). */
export function getDefaultAcademyId(): Types.ObjectId {
	const hex = env.DEV_ACADEMY_ID ?? '507f1f77bcf86cd799439011';
	return new Types.ObjectId(hex);
}
