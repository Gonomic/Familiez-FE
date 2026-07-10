import { describe, expect, it } from 'vitest';
import { calculateDisplayAge, isMarkedDeceased } from './personAgeUtils';

describe('personAgeUtils WG-03 rules', () => {
    const fixedNow = new Date('2026-07-10T12:00:00Z');

    it('returns age for living person without death markers', () => {
        const person = {
            PersonDateOfBirth: '2000-06-01',
            PersonDateOfDeath: '',
            PersonPlaceOfDeath: '',
        };

        expect(calculateDisplayAge(person, fixedNow)).toBe(26);
    });

    it('returns age at death when death date is known', () => {
        const person = {
            PersonDateOfBirth: '1950-01-01',
            PersonDateOfDeath: '2020-12-31',
            PersonPlaceOfDeath: 'Den Haag',
        };

        expect(calculateDisplayAge(person, fixedNow)).toBe(70);
    });

    it('returns null for deceased person without known death date (WG-03)', () => {
        const person = {
            PersonDateOfBirth: '1980-03-10',
            PersonDateOfDeath: '',
            PersonPlaceOfDeath: 'Onbekend',
        };

        expect(isMarkedDeceased(person)).toBe(true);
        expect(calculateDisplayAge(person, fixedNow)).toBeNull();
    });

    it('supports boolean death flags without death date', () => {
        const person = {
            PersonDateOfBirth: '1980-03-10',
            PersonDateOfDeath: '',
            PersonIsDeceased: 1,
        };

        expect(isMarkedDeceased(person)).toBe(true);
        expect(calculateDisplayAge(person, fixedNow)).toBeNull();
    });
});
