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
        expect(screen.queryByText('Kind toevoegen')).not.toBeInTheDocument();
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
});
