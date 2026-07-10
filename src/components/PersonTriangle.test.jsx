import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PersonTriangle from './PersonTriangle';

const basePerson = {
    PersonID: 101,
    PersonGivvenName: 'Jan',
    PersonFamilyName: 'Jansen',
    PersonDateOfBirth: '2000-01-01',
    PersonDateOfDeath: '',
    PersonPlaceOfDeath: '',
    PersonIsMale: 1,
};

const renderTriangle = (person) => {
    render(
        <svg>
            <PersonTriangle
                person={person}
                x={100}
                y={100}
            />
        </svg>
    );
};

describe('PersonTriangle age rendering', () => {
    it('shows age text for a living person', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));

        renderTriangle(basePerson);

        expect(screen.getByText('26 jaar')).toBeInTheDocument();

        vi.useRealTimers();
    });

    it('hides age text for deceased person without death date (WG-03)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));

        renderTriangle({
            ...basePerson,
            PersonPlaceOfDeath: 'Onbekend',
        });

        expect(screen.queryByText(/jaar$/i)).not.toBeInTheDocument();

        vi.useRealTimers();
    });
});
