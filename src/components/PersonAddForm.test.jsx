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
        getPartners: vi.fn(),
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
        familyDataService.getPartners.mockResolvedValue([]);
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

    it('prefills surname and only locks one parent for sibling add when parents are no longer partners', async () => {
        const user = userEvent.setup();

        familyDataService.getFather.mockResolvedValue(10);
        familyDataService.getMother.mockResolvedValue(20);
        familyDataService.getPartners.mockResolvedValue([
            { PersonID: 99, PersonGivvenName: 'Gerda', PersonFamilyName: 'Dekkers' },
        ]);
        familyDataService.getPersonDetails.mockImplementation(async (personId) => {
            if (personId === 10) {
                return {
                    PersonID: 10,
                    PersonGivvenName: 'Frans',
                    PersonFamilyName: 'Dekkers',
                    PersonIsMale: 1,
                };
            }

            if (personId === 20) {
                return {
                    PersonID: 20,
                    PersonGivvenName: 'Carin',
                    PersonFamilyName: 'Jansen',
                    PersonIsMale: 0,
                };
            }

            return null;
        });
        familyDataService.getPossibleMothersBasedOnAge.mockResolvedValue([
            {
                PossibleMotherID: 20,
                PossibleMother: 'Carin Jansen',
                PersonDateOfBirth: '1965-01-01',
            },
        ]);

        const { container } = render(
            <PersonAddForm
                relationAction="brother"
                sourcePerson={{ PersonID: 42, PersonFamilyName: 'Dekkers' }}
                onAdd={() => {}}
                onCancel={() => {}}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /Achternaam/i })).toHaveValue('Dekkers');
            expect(screen.getByLabelText('Vader')).toHaveValue('Frans Dekkers');
        });

        expect(screen.queryByDisplayValue('Carin Jansen')).not.toBeInTheDocument();

        const birthDateInput = container.querySelector('input[type="date"]');
        expect(birthDateInput).toBeTruthy();
        fireEvent.change(birthDateInput, { target: { value: '2000-01-01' } });

        await waitFor(() => {
            expect(familyDataService.getPossibleMothersBasedOnAge).toHaveBeenCalledWith('2000-01-01');
        });

        await user.click(screen.getByRole('combobox', { name: 'Moeder' }));
        expect(await screen.findByRole('option', { name: 'Carin Jansen (01-01-1965)' })).toBeInTheDocument();
    });
});
