import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PersonAddForm from './PersonAddForm';
import * as familyDataService from '../services/familyDataService';

vi.mock('../services/familyDataService', async () => {
    const actual = await vi.importActual('../services/familyDataService');
    return {
        ...actual,
        addPerson: vi.fn(),
        getPossibleMothersBasedOnAge: vi.fn(),
        getPossibleFathersBasedOnAge: vi.fn(),
        getPossiblePartnersBasedOnAge: vi.fn(),
        getChildren: vi.fn(),
        getFather: vi.fn(),
        getMother: vi.fn(),
        getPersonDetails: vi.fn(),
    };
});

describe('PersonAddForm sibling guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        familyDataService.getFather.mockResolvedValue(null);
        familyDataService.getMother.mockResolvedValue(null);
        familyDataService.getPersonDetails.mockResolvedValue(null);
        familyDataService.getPossiblePartnersBasedOnAge.mockResolvedValue([]);
        familyDataService.getPossibleMothersBasedOnAge.mockResolvedValue([]);
        familyDataService.getPossibleFathersBasedOnAge.mockResolvedValue([]);
        familyDataService.getChildren.mockResolvedValue([]);
        familyDataService.addPerson.mockResolvedValue({ success: true, person: { PersonID: 123 } });
    });

    it('blocks adding brother when both parents are unknown and shows warning/error on screen', async () => {
        const user = userEvent.setup();

        const { container } = render(
            <PersonAddForm
                relationAction="brother"
                sourcePerson={{ PersonID: 42 }}
                onAdd={() => {}}
                onCancel={() => {}}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Broer/Zus toevoegen is geblokkeerd: er zijn geen bekende ouders om de relatie op te baseren.')).toBeInTheDocument();
        });

        await user.type(screen.getByRole('textbox', { name: /Voornaam/i }), 'Jan');
        await user.type(screen.getByRole('textbox', { name: /Achternaam/i }), 'Jansen');
        await user.type(screen.getByRole('textbox', { name: /Geboorteplaats/i }), 'Den Haag');

        const birthDateInput = container.querySelector('input[type="date"]');
        expect(birthDateInput).toBeTruthy();
        fireEvent.change(birthDateInput, { target: { value: '2000-01-01' } });

        await user.click(screen.getByRole('button', { name: 'Bewaren' }));

        await waitFor(() => {
            expect(screen.getByText('Broer/Zus toevoegen is niet mogelijk: geselecteerde persoon heeft geen bekende vader en moeder.')).toBeInTheDocument();
        });

        expect(familyDataService.addPerson).not.toHaveBeenCalled();
    });
});
