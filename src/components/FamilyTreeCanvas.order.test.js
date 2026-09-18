import { describe, expect, it } from 'vitest';
import { orderGenerationPersonIds } from './FamilyTreeCanvas';

const person = (birthDate) => ({ PersonDateOfBirth: birthDate });

describe('FamilyTreeCanvas generation ordering', () => {
    it('orders siblings by age and attaches partners without letting partner age reorder siblings', () => {
        const familyData = new Map([
            [1, person('1980-01-01')],
            [2, person('1985-01-01')],
            [3, person('1990-01-01')],
            [101, person('1970-01-01')],
            [102, person('2005-01-01')],
            [103, person('1960-01-01')],
        ]);
        const parentsMap = new Map([
            [1, { fatherId: 900, motherId: 901 }],
            [2, { fatherId: 900, motherId: 901 }],
            [3, { fatherId: 900, motherId: 901 }],
        ]);
        const partnersMap = new Map([
            [1, [101]],
            [101, [1]],
            [2, [102]],
            [102, [2]],
            [3, [103]],
            [103, [3]],
        ]);

        expect(orderGenerationPersonIds({
            personIds: [1, 2, 3, 101, 102, 103],
            generation: 0,
            rootPersonId: 1,
            familyData,
            parentsMap,
            partnersMap,
        })).toEqual([1, 101, 2, 102, 3, 103]);
    });
});