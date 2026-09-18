import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../pages/LoginPage';
import { getStackBuildNumber } from '../services/familyDataService';

vi.mock('../services/authService', () => ({
    initiateSSOLogin: vi.fn(),
}));

vi.mock('../services/familyDataService', () => ({
    getStackBuildNumber: vi.fn(),
}));

describe('LoginPage stack build status', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('explains when no active stack build is available', async () => {
        getStackBuildNumber.mockResolvedValue(null);

        render(<MemoryRouter><LoginPage /></MemoryRouter>);

        await waitFor(() => expect(screen.getByText(/Build onbekend/)).toBeInTheDocument());
        expect(screen.getByText(/middleware of database niet actief/)).toBeInTheDocument();
    });

    it('explains when the stack build response is invalid', async () => {
        const error = new Error('Invalid stack build response');
        error.code = 'INVALID_STACK_BUILD_RESPONSE';
        getStackBuildNumber.mockRejectedValue(error);

        render(<MemoryRouter><LoginPage /></MemoryRouter>);

        await waitFor(() => expect(screen.getByText(/Build onbekend/)).toBeInTheDocument());
        expect(screen.getByText(/ongeldige versie-informatie ontvangen/)).toBeInTheDocument();
    });
});
