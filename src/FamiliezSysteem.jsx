import { useEffect, useRef } from 'react'
import { useSignal } from '@preact/signals-react'
import { useSignals } from '@preact/signals-react/runtime'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import debounce from 'lodash/debounce'
import {
    fetchWithAuthHeaders,
    getMwBaseUrl,
    getMyPreferences,
    saveMyPreferences,
    getPersonsLike,
    getPersonDetails,
} from './services/familyDataService'

const SHOW_NON_PARTNER_PARENTS_KEY = 'familiez_show_non_partner_parents';

const FamiliezSysteem = () => {
    useSignals();
    const pingMwError = useSignal("");
    const pingDbError = useSignal("");
    const DBDtFeReq = useSignal("");
    const DBDtMwReq = useSignal("");
    const DBDtBeReq = useSignal("");
    const DBDtBeAnsw = useSignal("");
    const DBDtMwAnsw = useSignal("");
    const DBFEDtRec = useSignal("");
    const DBFEDtRoundTrip = useSignal("");

    const MWDtFeReq = useSignal("");
    const MWDtMwReq = useSignal("");

    const FEFEDtRec = useSignal("");
    const FEFEDtRoundTrip = useSignal("");
    const showNonPartnerParents = useSignal(false);
    const preferencesLoading = useSignal(false);
    const preferencesSaving = useSignal(false);
    const preferencesError = useSignal('');
    const preferencesSuccess = useSignal('');
    const linkedPerson = useSignal(null);
    const linkedPersonOptions = useSignal([]);
    const linkedPersonInputValue = useSignal('');
    const generationsUp = useSignal('3');
    const generationsDown = useSignal('3');
    const autoShowTree = useSignal(false);
    const isSelectingLinkedPersonRef = useRef(false);

    const debouncedSearchPersons = useRef(
        debounce(async (value) => {
            if (isSelectingLinkedPersonRef.current) {
                return;
            }

            if (!value || value.trim().length < 2) {
                linkedPersonOptions.value = [];
                return;
            }

            try {
                const persons = await getPersonsLike(value);
                linkedPersonOptions.value = persons;
            } catch (error) {
                console.error('Error while searching linked person:', error);
                linkedPersonOptions.value = [];
            }
        }, 500)
    ).current;

    useEffect(() => {
        const stored = localStorage.getItem(SHOW_NON_PARTNER_PARENTS_KEY);
        showNonPartnerParents.value = stored === 'true';
    // signal instance is stable for this component lifecycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadMyPreferences = async () => {
            preferencesLoading.value = true;
            preferencesError.value = '';
            preferencesSuccess.value = '';

            try {
                const preferences = await getMyPreferences();

                if (!isMounted) {
                    return;
                }

                generationsUp.value = String(preferences.generations_up ?? 3);
                generationsDown.value = String(preferences.generations_down ?? 3);
                autoShowTree.value = Boolean(preferences.auto_show_tree);

                if (preferences.linked_person_id) {
                    const personDetails = await getPersonDetails(preferences.linked_person_id);
                    if (!isMounted) {
                        return;
                    }

                    if (personDetails) {
                        linkedPerson.value = personDetails;
                        linkedPersonOptions.value = [personDetails];
                        linkedPersonInputValue.value = `${personDetails.PersonGivvenName} ${personDetails.PersonFamilyName} (${personDetails.PersonDateOfBirth})`;
                    } else {
                        linkedPerson.value = null;
                        linkedPersonInputValue.value = '';
                    }
                } else {
                    linkedPerson.value = null;
                    linkedPersonInputValue.value = '';
                }
            } catch (error) {
                console.error('Error loading my preferences:', error);
                if (isMounted) {
                    preferencesError.value = error?.message || 'Instellingen laden is mislukt';
                }
            } finally {
                if (isMounted) {
                    preferencesLoading.value = false;
                }
            }
        };

        loadMyPreferences();

        return () => {
            isMounted = false;
            debouncedSearchPersons.cancel();
        };
    }, [
        autoShowTree,
        debouncedSearchPersons,
        generationsDown,
        generationsUp,
        linkedPerson,
        linkedPersonInputValue,
        linkedPersonOptions,
        preferencesError,
        preferencesLoading,
        preferencesSuccess,
    ]);

    const handleLinkedPersonInputChange = (event, newInputValue) => {
        linkedPersonInputValue.value = newInputValue;
        preferencesSuccess.value = '';
        preferencesError.value = '';

        if (!isSelectingLinkedPersonRef.current) {
            debouncedSearchPersons(newInputValue);
        }

        isSelectingLinkedPersonRef.current = false;
    };

    const handleLinkedPersonChange = (event, newValue) => {
        linkedPerson.value = newValue;
        isSelectingLinkedPersonRef.current = true;
    };

    const handleGenerationChange = (setter) => (event) => {
        const { value } = event.target;
        if (value === '') {
            setter.value = '';
            return;
        }

        const parsed = parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            setter.value = String(parsed);
        }
    };

    const handleSaveMyPreferences = async () => {
        preferencesError.value = '';
        preferencesSuccess.value = '';

        const parsedUp = parseInt(generationsUp.value, 10);
        const parsedDown = parseInt(generationsDown.value, 10);

        if (!Number.isFinite(parsedUp) || parsedUp < 0 || parsedUp > 10) {
            preferencesError.value = 'Generaties omhoog moet tussen 0 en 10 liggen';
            return;
        }

        if (!Number.isFinite(parsedDown) || parsedDown < 0 || parsedDown > 10) {
            preferencesError.value = 'Generaties omlaag moet tussen 0 en 10 liggen';
            return;
        }

        preferencesSaving.value = true;
        try {
            await saveMyPreferences({
                linked_person_id: linkedPerson.value?.PersonID ?? null,
                generations_up: parsedUp,
                generations_down: parsedDown,
                auto_show_tree: autoShowTree.value,
            });
            preferencesSuccess.value = 'Instellingen opgeslagen';
        } catch (error) {
            preferencesError.value = error?.message || 'Instellingen opslaan is mislukt';
        } finally {
            preferencesSaving.value = false;
        }
    };

    const handleButtonClickToPingMW = async () => {
        try {
            pingMwError.value = "";
            const startTime = Date.now();
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000; // Offset in milliseconds
            const localISOTimeAsString = new Date(now - offset).toISOString().slice(0, -1);

            const url = `${getMwBaseUrl()}/pingAPI?timestampFE=${localISOTimeAsString}`;

            const response = await fetchWithAuthHeaders(url);
            if (!response.ok) {
                pingMwError.value = `Ping middleware mislukt (${response.status})`;
                return;
            }
            const data = await response.json();
            const endTime = Date.now();

            if (!Array.isArray(data) || data.length === 0) {
                pingMwError.value = "Onverwacht antwoord van middleware";
                return;
            }

            MWDtFeReq.value = data[0]["FE request time"] || "";
            MWDtMwReq.value = data[0]["MW request time"] || "";
            const nowAfter = new Date();
            FEFEDtRec.value = new Date(nowAfter - nowAfter.getTimezoneOffset() * 60000).toISOString().slice(0, -1);
            FEFEDtRoundTrip.value = `${(endTime - startTime).toFixed(2)} ms`;
        } catch (error) {
            console.error('Error getting Ping data from API (calling MW):', error);
            pingMwError.value = "Ping middleware mislukt";
        }
    };

    const handleButtonClickToPingDB = async () => {
        try {
            pingDbError.value = "";
            const startTime = Date.now();
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000; // Offset in milliseconds
            const localISOTime = new Date(now - offset).toISOString().slice(0, -1);

            const url = `${getMwBaseUrl()}/pingDB?timestampFE=${localISOTime}`;

            const responseDB = await fetchWithAuthHeaders(url);
            if (!responseDB.ok) {
                pingDbError.value = `Ping database mislukt (${responseDB.status})`;
                return;
            }
            const data = await responseDB.json();
            const endTime = Date.now();

            if (!Array.isArray(data) || data.length === 0) {
                pingDbError.value = "Onverwacht antwoord van database";
                return;
            }

            DBDtFeReq.value = data[0]["datetimeFErequest"] || "";
            DBDtMwReq.value = data[0]["datetimeMWrequest"] || "";
            DBDtBeReq.value = data[0]["datetimeBErequest"] || "";
            DBDtBeAnsw.value = data[0]["datetimeBEanswer"] || "";
            DBDtMwAnsw.value = data[0]["datetimeMWanswer"] || "";
            const nowAfter = new Date();
            DBFEDtRec.value = nowAfter.toISOString().slice(0, -1);
            DBFEDtRoundTrip.value = `${(endTime - startTime).toFixed(2)} ms`;
        } catch (error) {
            console.error('Error getting Ping data from API (calling DB):', error);
            pingDbError.value = "Ping database mislukt";
        }
    };

    const statLineSx = {
        m: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        color: 'text.secondary'
    };

    const renderAlignedLines = (rows) => {
        const maxLabelLength = rows.reduce((max, row) => Math.max(max, row.label.length), 0);
        return rows.map((row) => {
            const label = row.label.padEnd(maxLabelLength, ' ');
            const value = row.value || '-';
            return (
                <Typography key={row.label} component="pre" sx={statLineSx}>
                    {`${label}  ${value}`}
                </Typography>
            );
        });
    };

    return (
        <Box
            sx={{
                position: 'absolute',
                top: '64px',
                bottom: '72px',
                height: 'calc(100% - 136px)',
                width: '100%',
                overflow: 'auto',
                p: 3
            }}
        >
            <Typography variant="h5" sx={{ mb: 2 }}>
                Familiez Systeem
            </Typography>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        md: '1fr 1fr'
                    },
                    gap: 2,
                    alignItems: 'start'
                }}
            >
                <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        Ping Middleware
                    </Typography>
                    <Button variant="contained" onClick={handleButtonClickToPingMW} sx={{ mb: 1.5 }}>
                        Ping Middleware
                    </Button>
                    {pingMwError.value ? (
                        <Typography color="error" sx={{ mb: 1, fontFamily: 'monospace' }}>
                            {pingMwError.value}
                        </Typography>
                    ) : null}

                    {renderAlignedLines([
                        { label: 'Frontend request time:', value: MWDtFeReq.value },
                        { label: 'Middleware request time:', value: MWDtMwReq.value },
                        { label: 'Frontend receive time:', value: FEFEDtRec.value },
                        { label: 'Roundtrip time:', value: FEFEDtRoundTrip.value }
                    ])}
                </Paper>

                <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        Ping Database
                    </Typography>
                    <Button variant="contained" onClick={handleButtonClickToPingDB} sx={{ mb: 1.5 }}>
                        Ping Database
                    </Button>
                    {pingDbError.value ? (
                        <Typography color="error" sx={{ mb: 1, fontFamily: 'monospace' }}>
                            {pingDbError.value}
                        </Typography>
                    ) : null}

                    {renderAlignedLines([
                        { label: 'Frontend request time:', value: DBDtFeReq.value },
                        { label: 'Middleware request time:', value: DBDtMwReq.value },
                        { label: 'Backend request time:', value: DBDtBeReq.value },
                        { label: 'Backend answer time:', value: DBDtBeAnsw.value },
                        { label: 'Middleware answer time:', value: DBDtMwAnsw.value },
                        { label: 'Frontend receive time:', value: DBFEDtRec.value },
                        { label: 'Roundtrip time:', value: DBFEDtRoundTrip.value }
                    ])}
                </Paper>

                <Paper elevation={2} sx={{ p: 2, gridColumn: { xs: '1', md: '1 / -1' } }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        Systeeminstellingen
                    </Typography>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={showNonPartnerParents.value}
                                onChange={(event) => {
                                    const newValue = event.target.checked;
                                    showNonPartnerParents.value = newValue;
                                    localStorage.setItem(SHOW_NON_PARTNER_PARENTS_KEY, String(newValue));
                                    window.dispatchEvent(new CustomEvent('familiez-system-settings-updated', {
                                        detail: { showNonPartnerParents: newValue }
                                    }));
                                }}
                            />
                        }
                        label="Toon ook ouders die geen partners (meer) zijn."
                    />
                </Paper>

                <Paper elevation={2} sx={{ p: 2, gridColumn: { xs: '1', md: '1 / -1' } }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        Mijn stamboom instellingen
                    </Typography>

                    {preferencesLoading.value ? (
                        <Typography sx={{ mb: 2 }} color="text.secondary">
                            Instellingen laden...
                        </Typography>
                    ) : null}

                    {preferencesError.value ? (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {preferencesError.value}
                        </Alert>
                    ) : null}

                    {preferencesSuccess.value ? (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            {preferencesSuccess.value}
                        </Alert>
                    ) : null}

                    <Autocomplete
                        value={linkedPerson.value}
                        onChange={handleLinkedPersonChange}
                        inputValue={linkedPersonInputValue.value}
                        onInputChange={handleLinkedPersonInputChange}
                        options={linkedPersonOptions.value}
                        getOptionLabel={(option) => (
                            `${option.PersonGivvenName} ${option.PersonFamilyName} (${option.PersonDateOfBirth})`
                        )}
                        isOptionEqualToValue={(option, value) => option.PersonID === value.PersonID}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Zoek en selecteer uw persoon in de stamboom"
                                InputLabelProps={{ shrink: true }}
                            />
                        )}
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        type="number"
                        label="Generaties omhoog tonen"
                        value={generationsUp.value}
                        onChange={handleGenerationChange(generationsUp)}
                        InputProps={{ inputProps: { min: 0, max: 10, step: 1 } }}
                        fullWidth
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        type="number"
                        label="Generaties omlaag tonen"
                        value={generationsDown.value}
                        onChange={handleGenerationChange(generationsDown)}
                        InputProps={{ inputProps: { min: 0, max: 10, step: 1 } }}
                        fullWidth
                        sx={{ mb: 2 }}
                    />

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={autoShowTree.value}
                                onChange={(event) => {
                                    autoShowTree.value = event.target.checked;
                                }}
                            />
                        }
                        label="Stamboom automatisch tonen na inloggen"
                        sx={{ mb: 2 }}
                    />

                    <Button
                        variant="contained"
                        onClick={handleSaveMyPreferences}
                        disabled={preferencesSaving.value}
                    >
                        {preferencesSaving.value ? 'Opslaan...' : 'Opslaan'}
                    </Button>
                </Paper>
            </Box>
        </Box>

    );
};

export default FamiliezSysteem;