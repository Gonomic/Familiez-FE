import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ParentAddForm from './ParentAddForm';
import * as familyDataService from '../services/familyDataService';

vi.mock('../services/familyDataService', () => ({
    addNewParentToChild: vi.fn(),
    getFather: vi.fn(),
    getMother: vi.fn(),
    getPersonDetails: vi.fn(),
    getPossiblePartnersBasedOnAge: vi.fn(),
}));

const childPerson = {
    PersonID: 42,
    PersonGivvenName: 'Piet',
    PersonFamilyName: 'Jansen',
};

const fillRequiredFields = async (container, givenName = 'Anna') => {
    fireEvent.change(screen.getByRole('textbox', { name: 'Voornaam' }), { target: { value: givenName } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Achternaam' }), { target: { value: 'Jansen' } });
    fireEvent.change(container.querySelector('input[type="date"]'), {
        target: { value: '1900-01-02' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Geboorteplaats' }), { target: { value: 'Leiden' } });
    await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Partner (optioneel)' })).toBeEnabled();
    });
};

describe('ParentAddForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        familyDataService.getFather.mockResolvedValue(null);
        familyDataService.getMother.mockResolvedValue(null);
        familyDataService.getPersonDetails.mockResolvedValue(null);
        familyDataService.getPossiblePartnersBasedOnAge.mockResolvedValue([]);
        familyDataService.addNewParentToChild.mockResolvedValue({
            success: true,
            personId: 91,
            warning: null,
        });
    });

    it('sends the parent data and leaves a successful partner warning visible', async () => {
        const user = userEvent.setup();
        const onAdd = vi.fn();
        familyDataService.addNewParentToChild.mockResolvedValue({
            success: true,
            personId: 91,
            warning: 'De partner heeft al een partnerrelatie.',
        });
        const { container } = render(
            <ParentAddForm childPerson={childPerson} parentRole="father" onAdd={onAdd} onCancel={() => {}} />
        );

        await fillRequiredFields(container);
        await user.click(screen.getByRole('button', { name: 'Bewaren' }));

        await waitFor(() => {
            expect(familyDataService.addNewParentToChild).toHaveBeenCalledWith({
                kindId: 42,
                gender: 1,
                givenName: 'Anna',
                familyName: 'Jansen',
                birthDate: '1900-01-02',
                birthPlace: 'Leiden',
                deathDate: null,
                deathPlace: null,
                partnerId: null,
                marriageDate: null,
                marriagePlace: null,
            });
        });
        expect(onAdd).toHaveBeenCalledWith({ PersonID: 91 });
        expect(screen.getByRole('alert')).toHaveTextContent('De partner heeft al een partnerrelatie.');
        expect(screen.getByRole('button', { name: 'Sluiten' })).toBeInTheDocument();
    }, 10000);

    it('shows duplicate-person errors without refreshing the tree', async () => {
        const user = userEvent.setup();
        const onAdd = vi.fn();
        familyDataService.addNewParentToChild.mockResolvedValue({
            success: false,
            error: 'De toe te voegen Moeder bestaat al als persoon in de database.',
        });
        const { container } = render(
            <ParentAddForm childPerson={childPerson} parentRole="mother" onAdd={onAdd} onCancel={() => {}} />
        );

        await fillRequiredFields(container, 'Maria');
        await user.click(screen.getByRole('button', { name: 'Bewaren' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'De toe te voegen Moeder bestaat al als persoon in de database.'
        );
        expect(onAdd).not.toHaveBeenCalled();
    });

    it('shows and blocks an existing parent of the same role', async () => {
        familyDataService.getFather.mockResolvedValue(12);
        familyDataService.getPersonDetails.mockResolvedValue({
            PersonID: 12,
            PersonGivvenName: 'Pieter',
            PersonFamilyName: 'Jansen',
        });

        render(
            <ParentAddForm childPerson={childPerson} parentRole="father" onAdd={() => {}} onCancel={() => {}} />
        );

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Er is al een vader gekoppeld: Pieter Jansen. Deze relatie blijft ongewijzigd.'
        );
        expect(screen.getByRole('button', { name: 'Bewaren' })).toBeDisabled();
        expect(familyDataService.addNewParentToChild).not.toHaveBeenCalled();
    });

    it('maps an optional partner and marriage to the middleware request', async () => {
        const user = userEvent.setup();
        familyDataService.getPossiblePartnersBasedOnAge.mockResolvedValue([
            {
                PossiblePartnerID: 77,
                PossiblePartner: 'Jan Pieters',
                PersonDateOfBirth: '1890-03-04',
            },
        ]);
        const { container } = render(
            <ParentAddForm childPerson={childPerson} parentRole="mother" onAdd={() => {}} onCancel={() => {}} />
        );

        await fillRequiredFields(container, 'Maria');
        await waitFor(() => {
            expect(familyDataService.getPossiblePartnersBasedOnAge).toHaveBeenCalledWith('1900-01-02', {
                throwOnError: true,
            });
        });
        await user.click(screen.getByRole('combobox', { name: 'Partner (optioneel)' }));
        await user.click(await screen.findByRole('option', { name: 'Jan Pieters (04-03-1890)' }));
        fireEvent.change(screen.getByLabelText('Huwelijksdatum'), { target: { value: '1920-05-06' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Huwelijksplaats' }), {
            target: { value: 'Rotterdam' },
        });
        await user.click(screen.getByRole('button', { name: 'Bewaren' }));

        await waitFor(() => {
            expect(familyDataService.addNewParentToChild).toHaveBeenCalledWith(
                expect.objectContaining({
                    kindId: 42,
                    gender: 0,
                    partnerId: 77,
                    marriageDate: '1920-05-06',
                    marriagePlace: 'Rotterdam',
                })
            );
        });
    });
});