import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PersonContextMenu from './PersonContextMenu';

vi.mock('../services/authService', () => ({
    getUserInfo: () => ({ is_admin: true }),
}));

describe('PersonContextMenu WG-02 actions', () => {
    it('shows sibling and child gender add options for admins', () => {
        render(
            <PersonContextMenu
                anchorPosition={{ x: 120, y: 120 }}
                onClose={() => {}}
                onEditPerson={() => {}}
                onDeletePerson={() => {}}
                onAddPerson={() => {}}
                onViewPerson={() => {}}
                onManageFiles={() => {}}
                person={{ PersonID: 7 }}
            />
        );

        expect(screen.getByText('Broer toevoegen')).toBeInTheDocument();
        expect(screen.getByText('Zus toevoegen')).toBeInTheDocument();
        expect(screen.getByText('Dochter toevoegen')).toBeInTheDocument();
        expect(screen.getByText('Zoon toevoegen')).toBeInTheDocument();
        expect(screen.getByText('Vader toevoegen')).toBeInTheDocument();
        expect(screen.getByText('Moeder toevoegen')).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Vader toevoegen' })).toBeEnabled();
        expect(screen.getByRole('menuitem', { name: 'Moeder toevoegen' })).toBeEnabled();
        expect(screen.queryByText('Kind toevoegen')).not.toBeInTheDocument();
    });

    it.each([
        ['father', 'Vader toevoegen', 'Moeder toevoegen'],
        ['mother', 'Moeder toevoegen', 'Vader toevoegen'],
    ])('disables adding an existing %s while keeping the other parent option active', (parentRole, disabledLabel, enabledLabel) => {
        const onAddPerson = vi.fn();
        const menuProps = {
            anchorPosition: { x: 120, y: 120 },
            onClose: vi.fn(),
            onEditPerson: vi.fn(),
            onDeletePerson: vi.fn(),
            onAddPerson,
            onViewPerson: vi.fn(),
            onManageFiles: vi.fn(),
            person: { PersonID: 7 },
            hasFather: parentRole === 'father',
            hasMother: parentRole === 'mother',
        };

        render(<PersonContextMenu {...menuProps} />);

        const disabledOption = screen.getByRole('menuitem', { name: disabledLabel });
        const enabledOption = screen.getByRole('menuitem', { name: enabledLabel });
        expect(disabledOption).toHaveAttribute('aria-disabled', 'true');
        expect(enabledOption).toBeEnabled();

        fireEvent.click(disabledOption);

        expect(onAddPerson).not.toHaveBeenCalled();
        expect(menuProps.onClose).not.toHaveBeenCalled();
    });

    it('routes the selected relation action on click', () => {
        const onAddPerson = vi.fn();
        const onClose = vi.fn();
        const person = { PersonID: 9 };

        render(
            <PersonContextMenu
                anchorPosition={{ x: 120, y: 120 }}
                onClose={onClose}
                onEditPerson={() => {}}
                onDeletePerson={() => {}}
                onAddPerson={onAddPerson}
                onViewPerson={() => {}}
                onManageFiles={() => {}}
                person={person}
            />
        );

        fireEvent.click(screen.getByText('Dochter toevoegen'));

        expect(onAddPerson).toHaveBeenCalledWith(person, 'daughter');
        expect(onClose).toHaveBeenCalled();
    });

    it.each([
        ['Vader toevoegen', 'father'],
        ['Moeder toevoegen', 'mother'],
    ])('routes %s to the parent form', (label, relationAction) => {
        const onAddPerson = vi.fn();
        const person = { PersonID: 12 };

        render(
            <PersonContextMenu
                anchorPosition={{ x: 120, y: 120 }}
                onClose={() => {}}
                onEditPerson={() => {}}
                onDeletePerson={() => {}}
                onAddPerson={onAddPerson}
                onViewPerson={() => {}}
                onManageFiles={() => {}}
                person={person}
            />
        );

        fireEvent.click(screen.getByText(label));

        expect(onAddPerson).toHaveBeenCalledWith(person, relationAction);
    });
});
