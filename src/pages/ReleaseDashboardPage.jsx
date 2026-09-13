import { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Stack,
    Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getCapabilities } from '../services/familyDataService';

const statusColor = (status) => (status === 'passed' ? 'success' : 'error');
const registryLayerForComponent = (component) => (component === 'DB' ? 'BE' : component);

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
    const functionsByComponent = Object.fromEntries(
        Object.keys(components).map((component) => [
            component,
            functions.filter((item) => item.layer === registryLayerForComponent(component)),
        ])
    );

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

                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                    gap: 2
                }}>
                    <Box>
                        <Card variant="outlined"><CardContent>
                            <Typography color="text.secondary">Stack build</Typography>
                            <Typography variant="h5">{manifest?.stackBuildNumber ?? 'Niet beschikbaar'}</Typography>
                        </CardContent></Card>
                    </Box>
                    <Box>
                        <Card variant="outlined"><CardContent>
                            <Typography color="text.secondary">Geregistreerde functies</Typography>
                            <Typography variant="h5">{functions.length}</Typography>
                        </CardContent></Card>
                    </Box>
                    <Box>
                        <Card variant="outlined"><CardContent>
                            <Typography color="text.secondary">Afhankelijkheden</Typography>
                            <Typography variant="h5">{dependencies.length}</Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                (FE/MW) &lt;-&gt; (MW/DB)
                            </Typography>
                        </CardContent></Card>
                    </Box>
                </Box>

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
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Componentversies en Function Registry</Typography>
                    {Object.keys(components).length === 0 ? (
                        <Alert severity="info">Er is nog geen stack-manifest beschikbaar.</Alert>
                    ) : (
                        <Stack spacing={1}>
                            {Object.entries(components).map(([component, details]) => (
                                <Accordion
                                    disableGutters
                                    elevation={0}
                                    key={component}
                                    sx={{
                                        border: 1,
                                        borderColor: 'divider',
                                        '&:before': { display: 'none' },
                                    }}
                                >
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.25, sm: 2 }}>
                                            <Typography fontWeight="medium">{component}</Typography>
                                            <Typography color="text.secondary">
                                                {details?.version || 'Onbekend'} · {functionsByComponent[component].length} {functionsByComponent[component].length === 1 ? 'functie' : 'functies'}
                                            </Typography>
                                        </Stack>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ pt: 0 }}>
                                        {functionsByComponent[component].length === 0 ? (
                                            <Typography color="text.secondary">Er zijn geen functies geregistreerd voor dit component.</Typography>
                                        ) : (
                                            <Stack spacing={1}>
                                                {functionsByComponent[component].map((item) => (
                                                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} key={`${item.layer}-${item.name}`}>
                                                        <Typography>{item.name}</Typography>
                                                        <Chip size="small" label={item.version || 'Onbekend'} variant="outlined" />
                                                    </Stack>
                                                ))}
                                            </Stack>
                                        )}
                                    </AccordionDetails>
                                </Accordion>
                            ))}
                        </Stack>
                    )}
                </Box>
            </Stack>
        </Container>
    );
};

export default ReleaseDashboardPage;