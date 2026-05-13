import { describe, it, expect } from 'vitest';
import { escapeRegex } from './mongo-util';

describe('escapeRegex', () => {
	it('정규식 특수문자를 이스케이프한다', () => {
		expect(escapeRegex('a+b')).toBe('a\\+b');
		expect(escapeRegex('test.')).toBe('test\\.');
	});
});
