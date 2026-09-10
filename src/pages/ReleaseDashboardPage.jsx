import { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Divider,
    Grid,
    Stack,
    Typography,
} from '@mui/material';
import { getCapabilities } from '../services/familyDataService';

const statusColor = (status) => (status === 'passed' ? 'success' : 'error');

const ReleaseDashboardPage = () => {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        getCapabilities()
            .then((result) => {
                if (isMounted) setData(result);
            })
            .catch((requestError) => {
                if (isMounted) setError(requestError?.message || 'Capabilities laden is mislukt');
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress aria-label="Laden" /></Box>;
    }

    if (error) {
        return <Container maxWidth="lg" sx={{ py: 4 }}><Alert severity="error">{error}</Alert></Container>;
    }

    const functions = data?.capabilities?.functions || [];
    const dependencies = data?.capabilities?.dependencies || [];
    const manifest = data?.stackManifest;
    const components = manifest?.components || {};
    const compatibility = manifest?.compatibilityCheck || 'unknown';

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
            <Stack spacing={3}>
                <Box>
                    <Typography variant="overline" color="text.secondary">Releasebeheer</Typography>
                    <Typography variant="h4" component="h1">Systeemcapaciteiten</Typography>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                        Actuele functies, afhankelijkheden en stackstatus.
                    </Typography>
                </Box>

                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                        <Card variant="outlined"><CardContent>
                            <Typography color="text.secondary">Stack build</Typography>
                            <Typography variant="h5">{manifest?.stackBuildNumber ?? 'Niet beschikbaar'}</Typography>
                        </CardContent></Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Card variant="outlined"><CardContent>
                            <Typography color="text.secondary">Geregistreerde functies</Typography>
                            <Typography variant="h5">{functions.length}</Typography>
                        </CardContent></Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Card variant="outlined"><CardContent>
                            <Typography color="text.secondary">Afhankelijkheden</Typography>
                            <Typography variant="h5">{dependencies.length}</Typography>
                        </CardContent></Card>
                    </Grid>
                </Grid>

                <Card variant="outlined">
                    <CardContent>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
                            <Box>
                                <Typography variant="h6">Compatibiliteit</Typography>
                                <Typography color="text.secondary">
                                    {manifest?.generatedAt ? `Gegenereerd op ${manifest.generatedAt}` : 'Geen stack-manifest beschikbaar'}
                                </Typography>
                            </Box>
                            <Chip label={compatibility} color={compatibility === 'unknown' ? 'default' : statusColor(compatibility)} />
                        </Stack>
                    </CardContent>
                </Card>

                <Box>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Componentversies</Typography>
                    {Object.keys(components).length === 0 ? (
                        <Alert severity="info">Er is nog geen stack-manifest beschikbaar.</Alert>
                    ) : (
                        <Stack spacing={1}>
                            {Object.entries(components).map(([component, details]) => (
                                <Card variant="outlined" key={component}>
                                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                                            <Typography fontWeight="medium">{component}</Typography>
                                            <Typography color="text.secondary">{details?.version || 'Onbekend'}</Typography>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))}
                        </Stack>
                    )}
                </Box>

                <Box>
                    <Typography variant="h6">Function Registry</Typography>
                    <Divider sx={{ my: 1.5 }} />
                    {functions.length === 0 ? (
                        <Typography color="text.secondary">Er zijn nog geen functies geregistreerd.</Typography>
                    ) : (
                        <Stack spacing={1}>
                            {functions.map((item) => (
                                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} key={`${item.layer}-${item.name}`}>
                                    <Typography>{item.layer}: {item.name}</Typography>
                                    <Chip size="small" label={item.version || 'Onbekend'} variant="outlined" />
                                </Stack>
                            ))}
                        </Stack>
                    )}
                </Box>
            </Stack>
        </Container>
    );
};

export default ReleaseDashboardPage;