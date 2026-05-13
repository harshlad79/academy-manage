import { Types } from 'mongoose';

/** Mongoose `populate().lean()` 이후 ref가 문서로 채워졌는지(단일 ObjectId는 제외). */
export function isPopulatedIdName(v: unknown): v is { _id: Types.ObjectId; name: string } {
	if (typeof v !== 'object' || v === null) return false;
	if (!('_id' in v) || !('name' in v)) return false;
	const o = v as { _id: unknown; name: unknown };
	if (typeof o.name !== 'string') return false;
	return o._id instanceof Types.ObjectId;
}

export function isPopulatedTeacherLean(
	v: unknown
): v is { _id: Types.ObjectId; name: string; subject?: string | null } {
	return isPopulatedIdName(v);
}
