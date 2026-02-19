import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Divider from '@mui/material/Divider'
import { getReleases } from './services/familyDataService'

const FamiliezInfo = () => {
    const [releases, setReleases] = useState({ fe: [], mw: [], be: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const fetchReleases = async () => {
            setIsLoading(true);
            setLoadError(null);
            try {
                const [fe, mw, be] = await Promise.all([
                    getReleases('fe'),
                    getReleases('mw'),
                    getReleases('be')
                ]);
                if (!isMounted) return;
                setReleases({ fe, mw, be });
            } catch (error) {
                if (!isMounted) return;
                setLoadError('Kan releases niet laden.');
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchReleases();

        return () => {
            isMounted = false;
        };
    }, []);

    const renderReleaseList = (label, items) => (
        <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom color="text.primary">
                {label}
            </Typography>
            {items.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    Geen releases gevonden.
                </Typography>
            ) : (
                items.map((release) => (
                    <Paper key={`${label}-${release.ReleaseID}`} elevation={1} sx={{ p: 2, mb: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            <strong>Release:</strong> {release.ReleaseNumber}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            <strong>Datum:</strong> {release.ReleaseDate}
                        </Typography>
                        {release.Description ? (
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                <strong>Omschrijving:</strong> {release.Description}
                            </Typography>
                        ) : null}
                        {release.Changes && release.Changes.length > 0 ? (
                            <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                    <strong>Wijzigingen:</strong>
                                </Typography>
                                <Box component="ul" sx={{ pl: 3, my: 0 }}>
                                    {release.Changes.map((change) => (
                                        <li key={`${label}-${release.ReleaseID}-${change.ChangeID}`}>
                                            <Typography variant="body2">
                                                {change.ChangeDescription}
                                                {change.ChangeType ? ` (${change.ChangeType})` : ''}
                                            </Typography>
                                        </li>
                                    ))}
                                </Box>
                            </Box>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                Geen wijzigingen geregistreerd.
                            </Typography>
                        )}
                    </Paper>
                ))
            )}
        </Box>
    );

    const latestFeRelease = releases.fe[0]?.ReleaseNumber || 'onbekend';
    const versionLabel = isLoading ? 'laden...' : latestFeRelease;

    return (
        <Box
            sx={{
                position: 'absolute',
                top: '64px',
                bottom: '72px',
                height: 'calc(100% - 136px)',
                width: '100%',
                p: 3
            }}
        >
            <Paper
                elevation={3}
                sx={{
                    p: 4,
                    maxWidth: 900,
                    mx: 'auto',
                    mt: 4,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <Box sx={{ flex: '0 0 auto' }}>
                <Typography variant="h4" component="h1" gutterBottom color="primary">
                    Familiez
                </Typography>
                <Typography variant="h6" gutterBottom color="text.secondary">
                    Genealogie Applicatie
                </Typography>

                <Divider sx={{ my: 2 }} />
                
                <Box sx={{ my: 2 }}>
                    <Typography variant="body1" gutterBottom>
                        <strong>Versie:</strong> {versionLabel}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                        <strong>Auteur:</strong> Frans Dekkers
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                        <strong>Copyright:</strong> © GoNomics 2026
                    </Typography>
                </Box>
                
                <Divider sx={{ my: 3 }} />
                
                <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
                    Een applicatie voor het beheren en visualiseren van genealogische gegevens.
                </Typography>

                <Divider sx={{ my: 4 }} />
                </Box>

                <Box sx={{ flex: '1 1 auto', overflowY: 'auto', pr: 1 }}>
                    <Typography variant="h5" gutterBottom color="text.primary">
                        Releases
                    </Typography>

                    {isLoading ? (
                        <Typography variant="body2" color="text.secondary">
                            Releases laden...
                        </Typography>
                    ) : loadError ? (
                        <Typography variant="body2" color="error">
                            {loadError}
                        </Typography>
                    ) : (
                        <Box sx={{ mt: 2 }}>
                            {renderReleaseList('Frontend', releases.fe)}
                            {renderReleaseList('Middleware', releases.mw)}
                            {renderReleaseList('Backend', releases.be)}
                        </Box>
                    )}
                </Box>
            </Paper>
        </Box>
    );
};

export default FamiliezInfo;