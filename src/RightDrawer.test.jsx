import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import RightDrawer from './RightDrawer';
import { getPersonsLike } from './services/familyDataService';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock('./services/authService', () => ({
    getUserInfo: () => ({ is_admin: true }),
}));

vi.mock('./services/familyDataService', () => ({
    getPersonsLike: vi.fn().mockResolvedValue([]),
}));

vi.mock('lodash/debounce', () => ({
    default: (fn) => {
        fn.cancel = vi.fn();
        return fn;
    },
}));

vi.mock('@mui/material/Drawer', () => ({
    default: ({ open, children }) => (open ? <div data-testid="right-drawer">{children}</div> : null),
}));

describe('RightDrawer build-tree prefill flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('prefills person from context action and builds tree with normalized PersonID', async () => {
        const onClose = vi.fn();
        const onPersonSelected = vi.fn();

        render(
            <RightDrawer
                open
                onClose={onClose}
                onPersonSelected={onPersonSelected}
                personToBuildTree={{
                    PersonID: '42',
                    PersonGivvenName: 'Jan',
                    PersonFamilyName: 'Jansen',
                    PersonDateOfBirth: '1970-01-01',
                }}
            />
        );

        const personInput = await screen.findByLabelText('Persoon');
        await waitFor(() => {
            expect(personInput).toHaveValue('Jan Jansen (1970-01-01)');
        });

        fireEvent.click(screen.getByRole('button', { name: 'Toon Stamboom' }));

        expect(onPersonSelected).toHaveBeenCalledTimes(1);
        expect(onPersonSelected).toHaveBeenCalledWith(
            expect.objectContaining({
                PersonID: 42,
                PersonGivvenName: 'Jan',
                PersonFamilyName: 'Jansen',
            }),
            1,
            1
        );
        expect(navigateMock).toHaveBeenCalledWith('/familiez-bewerken');
        expect(onClose).toHaveBeenCalled();
    });

    it('keeps the normal autocomplete selection flow working when no prefill is provided', async () => {
        const onClose = vi.fn();
        const onPersonSelected = vi.fn();
        const user = userEvent.setup();

        getPersonsLike.mockResolvedValue([
            {
                PersonID: 77,
                PersonGivvenName: 'Piet',
                PersonFamilyName: 'Peters',
                PersonDateOfBirth: '1980-02-02',
            },
        ]);

        render(
            <RightDrawer
                open
                onClose={onClose}
                onPersonSelected={onPersonSelected}
            />
        );

        const personInput = await screen.findByLabelText('Persoon');
        await user.type(personInput, 'Piet');

        const option = await screen.findByRole('option', { name: 'Piet Peters (1980-02-02)' });
        await user.click(option);

        fireEvent.change(screen.getByLabelText('Hoeveel generaties (over groot)ouders'), {
            target: { value: '2' },
        });
        fireEvent.change(screen.getByLabelText('Hoeveel generaties (achter klein)kinderen'), {
            target: { value: '3' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Toon Stamboom' }));

        await waitFor(() => {
            expect(onPersonSelected).toHaveBeenCalledWith(
                expect.objectContaining({
                    PersonID: 77,
                    PersonGivvenName: 'Piet',
                    PersonFamilyName: 'Peters',
                }),
                2,
                3
            );
        });

        expect(navigateMock).toHaveBeenCalledWith('/familiez-bewerken');
        expect(onClose).toHaveBeenCalled();
    });
});
