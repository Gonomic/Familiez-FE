import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReleaseDashboardPage from '../pages/ReleaseDashboardPage';
import { getCapabilities } from '../services/familyDataService';

vi.mock('../services/familyDataService', () => ({
    getCapabilities: vi.fn(),
}));

describe('ReleaseDashboardPage', () => {
    it('shows registry and stack status', async () => {
        getCapabilities.mockResolvedValue({
            capabilities: {
                functions: [{ layer: 'MW', name: 'get_person', version: 'v2' }],
                dependencies: [{ id: 1 }],
            },
            stackManifest: {
                stackBuildNumber: 42,
                compatibilityCheck: 'passed',
                components: { FE: { version: '1.0.0' }, MW: { version: '1.0.0' } },
            },
        });

        render(<ReleaseDashboardPage />);

        expect(screen.getByLabelText('Laden')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('Systeemcapaciteiten')).toBeInTheDocument());
        expect(screen.getByText(/get_person/)).toBeInTheDocument();
        expect(screen.getByText('passed')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('shows request errors', async () => {
        getCapabilities.mockRejectedValue(new Error('Server niet beschikbaar'));

        render(<ReleaseDashboardPage />);

        await waitFor(() => expect(screen.getByText('Server niet beschikbaar')).toBeInTheDocument());
    });
});