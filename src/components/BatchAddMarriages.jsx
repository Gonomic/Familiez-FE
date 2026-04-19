import { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Paper,
    Alert,
    CircularProgress,
    Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { createMarriage, getPossibleMarriagePairs } from '../services/familyDataService';

const BatchAddMarriages = () => {
    const [pairs, setPairs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [results, setResults] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const [rowStatuses, setRowStatuses] = useState({});

    // State for editable data: { "PersonAId_PersonBId": { startDate, marriagePlace } }
    const [editedData, setEditedData] = useState({});

    useEffect(() => {
        loadPairs();
    }, []);

    const loadPairs = async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const possiblePairs = await getPossibleMarriagePairs();
            setPairs(possiblePairs);
        } catch (error) {
            console.error('Error loading pairs:', error);
            setErrorMessage('Fout bij het laden van paren: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const getPairKey = (personAId, personBId) => `${personAId}_${personBId}`;

    const formatDateForDisplay = (value) => {
        if (!value) {
            return '';
        }

        const text = String(value).slice(0, 10);
        const parts = text.split('-');
        if (parts.length !== 3) {
            return text;
        }
        const [yyyy, mm, dd] = parts;
        return `${dd}-${mm}-${yyyy}`;
    };

    const parseDisplayDateToIso = (value) => {
        if (!value || typeof value !== 'string') {
            return null;
        }

        const trimmed = value.trim();
        let dd;
        let mm;
        let yyyy;

        const nlMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
        const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

        if (nlMatch) {
            [, dd, mm, yyyy] = nlMatch;
        } else if (isoMatch) {
            [, yyyy, mm, dd] = isoMatch;
        } else {
            return null;
        }

        const iso = `${yyyy}-${mm}-${dd}`;
        const parsed = new Date(`${iso}T00:00:00Z`);

        if (Number.isNaN(parsed.getTime())) {
            return null;
        }

        const validDay = parsed.getUTCDate() === Number(dd);
        const validMonth = parsed.getUTCMonth() + 1 === Number(mm);
        const validYear = parsed.getUTCFullYear() === Number(yyyy);
        if (!validDay || !validMonth || !validYear) {
            return null;
        }

        return iso;
    };

    const parseIsoDateToUtc = (value) => {
        if (!value) {
            return null;
        }

        const text = String(value).slice(0, 10);
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
        if (!match) {
            return null;
        }

        const [, yyyy, mm, dd] = match;
        const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
        if (Number.isNaN(date.getTime())) {
            return null;
        }

        if (
            date.getUTCFullYear() !== Number(yyyy)
            || date.getUTCMonth() + 1 !== Number(mm)
            || date.getUTCDate() !== Number(dd)
        ) {
            return null;
        }

        return date;
    };

    const addYearsUtc = (date, years) => {
        const nextDate = new Date(date.getTime());
        nextDate.setUTCFullYear(nextDate.getUTCFullYear() + years);
        return nextDate;
    };

    const updatePairData = (personAId, personBId, field, value) => {
        const pairKey = getPairKey(personAId, personBId);
        setEditedData((prev) => ({
            ...prev,
            [pairKey]: {
                ...prev[pairKey],
                [field]: value,
            },
        }));
    };

    const handleSave = async () => {
        setSuccessMessage('');
        setErrorMessage('');
        setResults([]);
        setRowStatuses({});

        // Find all pairs with filled data
        const pairsToSave = [];
        const validationErrors = [];
        for (const pairKey in editedData) {
            const data = editedData[pairKey];
            if (data.startDate) {
                const [personAId, personBId] = pairKey.split('_').map(Number);
                const isoStartDate = parseDisplayDateToIso(data.startDate);
                // Only save if startDate is filled
                const pair = pairs.find((p) => p.PersonAId === personAId && p.PersonBId === personBId);
                if (pair) {
                    if (!isoStartDate) {
                        validationErrors.push({
                            pairKey,
                            personA: pair.PersonAName,
                            personB: pair.PersonBName,
                            status: 'error',
                            message: 'Ongeldige datum. Gebruik formaat dd-mm-jjjj.',
                        });
                        continue;
                    }

                    const marriageDate = parseIsoDateToUtc(isoStartDate);
                    const personADob = parseIsoDateToUtc(pair.PersonADateOfBirth);
                    const personBDob = parseIsoDateToUtc(pair.PersonBDateOfBirth);

                    if (marriageDate && personADob && personBDob) {
                        const youngestDob = personADob > personBDob ? personADob : personBDob;
                        const oldestDob = personADob < personBDob ? personADob : personBDob;

                        const minMarriageDate = addYearsUtc(youngestDob, 15);
                        const maxMarriageDate = addYearsUtc(oldestDob, 90);

                        if (marriageDate < minMarriageDate || marriageDate > maxMarriageDate) {
                            validationErrors.push({
                                pairKey,
                                personA: pair.PersonAName,
                                personB: pair.PersonBName,
                                status: 'error',
                                message: `Huwelijksdatum ongeldig. Toegestaan: ${formatDateForDisplay(minMarriageDate.toISOString())} t/m ${formatDateForDisplay(maxMarriageDate.toISOString())}.`,
                            });
                            continue;
                        }
                    }

                    pairsToSave.push({
                        ...pair,
                        pairKey,
                        startDate: isoStartDate,
                        marriagePlace: data.marriagePlace || null,
                    });
                }
            }
        }

        if (pairsToSave.length === 0 && validationErrors.length === 0) {
            setErrorMessage('Geen huwelijk(en) ingevuld. Vul minstens een huwelijksdatum in voor paren die u wilt toevoegen.');
            return;
        }

        setIsSaving(true);
        const processedResults = [];

        for (let i = 0; i < pairsToSave.length; i++) {
            const pair = pairsToSave[i];
            try {
                const result = await createMarriage({
                    personAId: pair.PersonAId,
                    personBId: pair.PersonBId,
                    startDate: pair.startDate,
                    marriagePlace: pair.marriagePlace,
                });

                if (result.success) {
                    processedResults.push({
                        pairKey: pair.pairKey,
                        personA: pair.PersonAName,
                        personB: pair.PersonBName,
                        marriageId: result.marriageId,
                        status: 'success',
                        message: `Huwelijk aangemaakt (ID: ${result.marriageId})`,
                    });
                } else {
                    processedResults.push({
                        pairKey: pair.pairKey,
                        personA: pair.PersonAName,
                        personB: pair.PersonBName,
                        status: 'error',
                        message: result.error || 'Huwelijk aanmaken mislukt',
                    });
                }
            } catch (error) {
                processedResults.push({
                    pairKey: pair.pairKey,
                    personA: pair.PersonAName,
                    personB: pair.PersonBName,
                    status: 'error',
                    message: `Fout: ${error.message}`,
                });
            }
        }

        if (validationErrors.length > 0) {
            processedResults.push(...validationErrors);
        }

        setIsSaving(false);
        setResults(processedResults);
        setShowResults(true);

        const nextRowStatuses = {};
        processedResults.forEach((result) => {
            if (!result.pairKey) {
                return;
            }
            nextRowStatuses[result.pairKey] = {
                status: result.status,
                message: result.message,
            };
        });
        setRowStatuses(nextRowStatuses);

        const successCount = processedResults.filter((r) => r.status === 'success').length;
        const errorCount = processedResults.filter((r) => r.status === 'error').length;

        if (errorCount === 0) {
            setSuccessMessage(`✓ ${successCount} huwelijk(en) succesvol aangemaakt`);
        } else {
            setErrorMessage(`${successCount} succesvol, ${errorCount} mislukt`);
        }

        if (successCount > 0) {
            const successfulPairKeys = processedResults
                .filter((result) => result.status === 'success')
                .map((result) => result.pairKey);

            window.setTimeout(() => {
                const successfulPairKeySet = new Set(successfulPairKeys);

                setPairs((prev) =>
                    prev.filter((pair) => !successfulPairKeySet.has(getPairKey(pair.PersonAId, pair.PersonBId)))
                );

                setEditedData((prev) => {
                    const next = { ...prev };
                    successfulPairKeys.forEach((pairKey) => {
                        delete next[pairKey];
                    });
                    return next;
                });

                setRowStatuses((prev) => {
                    const next = { ...prev };
                    successfulPairKeys.forEach((pairKey) => {
                        delete next[pairKey];
                    });
                    return next;
                });
            }, 3500);
        }
    };

    const formatPersonLabel = (name, dateOfBirth) => {
        if (!dateOfBirth) {
            return name;
        }

        const dateText = formatDateForDisplay(dateOfBirth);
        return `${name} (${dateText})`;
    };

    return (
        <Box sx={{ p: 2, maxWidth: 1200, mx: 'auto' }}>
            <Card>
                <CardContent>
                    <h2>Batch huwelijken toevoegen</h2>

                    {successMessage && (
                        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
                            {successMessage}
                        </Alert>
                    )}
                    {errorMessage && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage('')}>
                            {errorMessage}
                        </Alert>
                    )}

                    {isLoading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                            <span style={{ marginLeft: '10px' }}>Paren laden...</span>
                        </Box>
                    ) : pairs.length === 0 ? (
                        <Alert severity="info">
                            Geen paren beschikbaar zonder huwelijk.
                            <Button
                                onClick={loadPairs}
                                size="small"
                                variant="text"
                                sx={{ ml: 1 }}
                            >
                                Vernieuwen
                            </Button>
                        </Alert>
                    ) : (
                        <>
                            <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
                                    onClick={handleSave}
                                    disabled={isSaving || pairs.length === 0}
                                >
                                    {isSaving ? 'Opslaan...' : 'Huwelijken opslaan'}
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<RefreshIcon />}
                                    onClick={loadPairs}
                                    disabled={isSaving}
                                >
                                    Vernieuwen
                                </Button>
                            </Box>

                            <Alert severity="info" sx={{ mb: 2 }}>
                                Vul alleen de rijen in waarvoor u huwelijksgegevens wilt toevoegen.
                                U hoeft niet alles in te vullen - alleen de Huwelijksdatum is verplicht.
                            </Alert>

                            <TableContainer component={Paper}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                            <TableCell>Persoon A</TableCell>
                                            <TableCell>Persoon B</TableCell>
                                            <TableCell>Huwelijksdatum</TableCell>
                                            <TableCell>Plaats huwelijk</TableCell>
                                            <TableCell>Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {pairs.map((pair) => {
                                            const pairKey = getPairKey(pair.PersonAId, pair.PersonBId);
                                            const rowStatus = rowStatuses[pairKey];
                                            return (
                                            <TableRow key={pair.PersonAId + '_' + pair.PersonBId}>
                                                <TableCell>{formatPersonLabel(pair.PersonAName, pair.PersonADateOfBirth)}</TableCell>
                                                <TableCell>{formatPersonLabel(pair.PersonBName, pair.PersonBDateOfBirth)}</TableCell>
                                                <TableCell>
                                                    <TextField
                                                        size="small"
                                                        type="text"
                                                        value={editedData[pairKey]?.startDate || ''}
                                                        onChange={(e) =>
                                                            updatePairData(pair.PersonAId, pair.PersonBId, 'startDate', e.target.value)
                                                        }
                                                        disabled={isSaving}
                                                        placeholder="dd-mm-jjjj"
                                                        inputProps={{ required: false, pattern: '\\d{2}-\\d{2}-\\d{4}' }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <TextField
                                                        size="small"
                                                        value={editedData[pairKey]?.marriagePlace || ''}
                                                        onChange={(e) =>
                                                            updatePairData(pair.PersonAId, pair.PersonBId, 'marriagePlace', e.target.value)
                                                        }
                                                        placeholder="Bijv. Amsterdam"
                                                        disabled={isSaving}
                                                        sx={{ width: '150px' }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {rowStatus?.status === 'success' && (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <CheckCircleIcon sx={{ color: 'success.main' }} titleAccess="Succesvol" />
                                                            <Typography variant="body2" color="success.main">
                                                                OK
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                    {rowStatus?.status === 'error' && (
                                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                                            <CancelIcon sx={{ color: 'error.main', mt: 0.25 }} titleAccess={rowStatus.message || 'Mislukt'} />
                                                            <Typography variant="body2" color="error.main" sx={{ maxWidth: 320 }}>
                                                                {rowStatus.message || 'Mislukt'}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {showResults && results.length > 0 && (
                                <Box sx={{ mt: 3 }}>
                                    <h3>Resultaten</h3>
                                    <TableContainer component={Paper}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                                    <TableCell>Persoon A</TableCell>
                                                    <TableCell>Persoon B</TableCell>
                                                    <TableCell>Status</TableCell>
                                                    <TableCell>Bericht</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {results.map((result, idx) => (
                                                    <TableRow
                                                        key={idx}
                                                        sx={{
                                                            backgroundColor:
                                                                result.status === 'success' ? '#c8e6c9' : '#ffcdd2',
                                                        }}
                                                    >
                                                        <TableCell>{result.personA}</TableCell>
                                                        <TableCell>{result.personB}</TableCell>
                                                        <TableCell>
                                                            <strong>{result.status}</strong>
                                                        </TableCell>
                                                        <TableCell>{result.message}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default BatchAddMarriages;
