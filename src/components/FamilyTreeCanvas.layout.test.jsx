import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FamilyTreeCanvas from './FamilyTreeCanvas';

const familyApi = vi.hoisted(() => ({
    getPersonDetails: vi.fn(),
    getFather: vi.fn(),
    getMother: vi.fn(),
    getChildren: vi.fn(),
    getPartners: vi.fn(),
    getActiveMarriageForPair: vi.fn(),
    getPersonPortraitUrl: vi.fn(),
}));

vi.mock('../services/familyDataService', () => familyApi);

const people = new Map([
    [1, { PersonID: 1, PersonGivvenName: 'Bert', PersonFamilyName: 'Sonneveld', PersonDateOfBirth: '1948-07-01', PersonIsMale: true }],
    [2, { PersonID: 2, PersonGivvenName: 'Marga', PersonFamilyName: 'Sonneveld', PersonDateOfBirth: '1956-02-05', PersonIsMale: false }],
    [3, { PersonID: 3, PersonGivvenName: 'Pieter', PersonFamilyName: 'Sonneveld', PersonDateOfBirth: '1911-04-01', PersonIsMale: true }],
    [4, { PersonID: 4, PersonGivvenName: 'Adriana', PersonFamilyName: 'Sonneveld', PersonDateOfBirth: '1913-02-06', PersonIsMale: false }],
    [5, { PersonID: 5, PersonGivvenName: 'Jan', PersonFamilyName: 'Sonneveld', PersonDateOfBirth: '1886-10-05', PersonIsMale: true }],
    [6, { PersonID: 6, PersonGivvenName: 'Elizabeth', PersonFamilyName: 'Sonneveld', PersonDateOfBirth: '1890-01-09', PersonIsMale: false }],
    [7, { PersonID: 7, PersonGivvenName: 'Jacob', PersonFamilyName: 'Poortvliet', PersonDateOfBirth: '1870-05-04', PersonIsMale: true }],
    [8, { PersonID: 8, PersonGivvenName: 'Jacomijntje', PersonFamilyName: 'Poortvliet', PersonDateOfBirth: '1875-06-21', PersonIsMale: false }],
]);

const parents = new Map([
    [1, { fatherId: 3, motherId: 4 }],
    [3, { fatherId: 5, motherId: 6 }],
    [4, { fatherId: 7, motherId: 8 }],
]);

const partners = new Map([
    [1, [2]], [2, [1]],
    [3, [4]], [4, [3]],
    [5, [6]], [6, [5]],
    [7, [8]], [8, [7]],
]);

const parseSegment = (path) => {
    const values = path.getAttribute('d')?.match(
        /^M\s*(-?[\d.]+)\s+(-?[\d.]+)\s+L\s+(-?[\d.]+)\s+(-?[\d.]+)$/
    );
    return values ? values.slice(1).map(Number) : null;
};

const segmentsCross = (first, second) => {
    const crossProduct = (ax, ay, bx, by, cx, cy) => (
        ((bx - ax) * (cy - ay)) - ((by - ay) * (cx - ax))
    );
    const [ax, ay, bx, by] = first;
    const [cx, cy, dx, dy] = second;
    const firstSideC = crossProduct(ax, ay, bx, by, cx, cy);
    const firstSideD = crossProduct(ax, ay, bx, by, dx, dy);
    const secondSideA = crossProduct(cx, cy, dx, dy, ax, ay);
    const secondSideB = crossProduct(cx, cy, dx, dy, bx, by);

    return firstSideC * firstSideD < 0 && secondSideA * secondSideB < 0;
};

describe('FamilyTreeCanvas ancestor connections', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        familyApi.getPersonDetails.mockImplementation(async (personId) => people.get(personId) || null);
        familyApi.getFather.mockImplementation(async (personId) => parents.get(personId)?.fatherId || null);
        familyApi.getMother.mockImplementation(async (personId) => parents.get(personId)?.motherId || null);
        familyApi.getChildren.mockResolvedValue([]);
        familyApi.getPartners.mockImplementation(async (personId) => (
            (partners.get(personId) || []).map(PersonID => ({ PersonID }))
        ));
        familyApi.getActiveMarriageForPair.mockResolvedValue(null);
        familyApi.getPersonPortraitUrl.mockResolvedValue(null);
    });

    afterEach(() => cleanup());

    it('keeps the two upper-generation parent branches from crossing', async () => {
        const { container } = render(
            <FamilyTreeCanvas
                rootPerson={people.get(1)}
                nbrOfParentGenerations={2}
                nbrOfChildGenerations={0}
            />
        );

        await screen.findByText('Bert Sonneveld');

        await waitFor(() => {
            expect(container.querySelectorAll('path[stroke="#666666"]')).toHaveLength(3);
        });

        const branches = [...container.querySelectorAll('path[stroke="#666666"]')]
            .map(parseSegment)
            .filter(Boolean);

        expect(branches).toHaveLength(3);
        const upperGenerationBranches = [...branches]
            .sort((first, second) => Math.min(first[1], first[3]) - Math.min(second[1], second[3]))
            .slice(0, 2);

        expect(upperGenerationBranches).toHaveLength(2);
        expect(segmentsCross(upperGenerationBranches[0], upperGenerationBranches[1])).toBe(false);
    });
});