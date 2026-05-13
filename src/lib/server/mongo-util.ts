/** 사용자 입력을 Mongo regex 리터럴에 안전하게 넣기 위한 이스케이프 */
export function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
