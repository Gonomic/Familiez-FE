import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonEditForm from './PersonEditForm';
import * as familyDataService from '../services/familyDataService';

vi.mock('../services/familyDataService', async () => {
    const actual = await vi.importActual('../services/familyDataService');
    return {
        ...actual,
        updatePerson: vi.fn(),
        createMarriage: vi.fn(),
        endMarriage: vi.fn(),
        updateMarriageStartDate: vi.fn(),
        getActiveMarriageForPerson: vi.fn(),
        getPossibleMothersBasedOnAge: vi.fn(),
        getPossibleFathersBasedOnAge: vi.fn(),
        getPossiblePartnersBasedOnAge: vi.fn(),
        getFather: vi.fn(),
        getMother: vi.fn(),
        getPartners: vi.fn(),
        getChildren: vi.fn(),
        getPersonDetails: vi.fn(),
    };
});

describe('PersonEditForm marriage start date fallback', () => {
    const person = {
        PersonID: 89,
        PersonGivvenName: 'Frans',
        PersonFamilyName: 'Dekkers',
        PersonDateOfBirth: '1930-01-01',
        PersonDateOfDeath: '',
        PersonPlaceOfBirth: 'Den Haag',
        PersonPlaceOfDeath: '',
        PersonIsMale: 1,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        familyDataService.getFather.mockResolvedValue(null);
        familyDataService.getMother.mockResolvedValue(null);
        familyDataService.getPartners.mockResolvedValue([]);
        familyDataService.getActiveMarriageForPerson.mockResolvedValue({
            MarriageID: 1,
            PartnerID: 207,
            StartDate: '1961-05-23',
        });
        familyDataService.getPossibleMothersBasedOnAge.mockResolvedValue([]);
        familyDataService.getPossibleFathersBasedOnAge.mockResolvedValue([]);
        familyDataService.getPossiblePartnersBasedOnAge.mockResolvedValue([]);
        familyDataService.getChildren.mockResolvedValue([]);
        familyDataService.getPersonDetails.mockResolvedValue(null);
        familyDataService.updatePerson.mockResolvedValue({ success: true, error: null });
        familyDataService.updateMarriageStartDate.mockResolvedValue({
            success: true,
            marriageId: 1,
            status: 200,
        });
        familyDataService.createMarriage.mockResolvedValue({ success: true, marriageId: 1, status: 200 });
        familyDataService.endMarriage.mockResolvedValue({ success: true, marriageId: 1, status: 200 });
    });

    it('updates marriage start date using active marriage partner when form partner is empty', async () => {
        const onSave = vi.fn();
        const user = userEvent.setup();
        const callOrder = [];

        familyDataService.updateMarriageStartDate.mockImplementation(async (...args) => {
            callOrder.push(['updateMarriageStartDate', ...args]);
            return { success: true, marriageId: 1, status: 200 };
        });

        familyDataService.updatePerson.mockImplementation(async (...args) => {
            callOrder.push(['updatePerson', ...args]);
            return { success: true, error: null };
        });

        render(
            <PersonEditForm
                person={person}
                onSave={onSave}
                onCancel={() => {}}
            />
        );

        const startDateInput = await screen.findByLabelText('Startdatum huwelijk');

        await waitFor(() => {
            expect(startDateInput).toHaveValue('1961-05-23');
        });

        await user.clear(startDateInput);
        await user.type(startDateInput, '2014-05-23');
        await user.click(screen.getByRole('button', { name: 'Opslaan' }));

        await waitFor(() => {
            expect(familyDataService.updatePerson).not.toHaveBeenCalled();
            expect(familyDataService.updateMarriageStartDate).toHaveBeenCalledWith(1, {
                personAId: 89,
                personBId: 207,
                startDate: '2014-05-23',
            });
        });

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(familyDataService.createMarriage).not.toHaveBeenCalled();
        expect(callOrder[0][0]).toBe('updateMarriageStartDate');
    });

    it('also calls the active marriage update route when the start date remains unchanged', async () => {
        const onSave = vi.fn();
        const user = userEvent.setup();

        render(
            <PersonEditForm
                person={person}
                onSave={onSave}
                onCancel={() => {}}
            />
        );

        await screen.findByLabelText('Startdatum huwelijk');
        await user.click(screen.getByRole('button', { name: 'Opslaan' }));

        await waitFor(() => {
            expect(familyDataService.updateMarriageStartDate).toHaveBeenCalledWith(1, {
                personAId: 89,
                personBId: 207,
                startDate: '1961-05-23',
            });
        });

        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('keeps the marriage date update without requiring person update when no person fields changed', async () => {
        const user = userEvent.setup();

        familyDataService.updateMarriageStartDate.mockResolvedValue({
            success: true,
            marriageId: 1,
            status: 200,
        });
        familyDataService.updatePerson.mockResolvedValue({ success: false, error: 'Wijziging mislukt - controleer database logs' });

        render(
            <PersonEditForm
                person={person}
                onSave={() => {}}
                onCancel={() => {}}
            />
        );

        const startDateInput = await screen.findByLabelText('Startdatum huwelijk');
        await user.clear(startDateInput);
        await user.type(startDateInput, '2014-05-23');
        await user.click(screen.getByRole('button', { name: 'Opslaan' }));

        await waitFor(() => {
            expect(familyDataService.updateMarriageStartDate).toHaveBeenCalledWith(1, {
                personAId: 89,
                personBId: 207,
                startDate: '2014-05-23',
            });
        });

        expect(familyDataService.updatePerson).not.toHaveBeenCalled();
        expect(screen.queryByText('Trouwdatum opgeslagen, maar persoonsgegevens opslaan mislukt: Wijziging mislukt - controleer database logs')).not.toBeInTheDocument();
    });
});
