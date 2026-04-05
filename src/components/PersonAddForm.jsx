import { useState, useEffect } from 'react';
import { Alert, Box, TextField, Button, Typography, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, MenuItem } from '@mui/material';
import { NO_CONNECTION_ERROR_TEXT } from '../constants/errorMessages';
import PropTypes from 'prop-types';
import { addPerson, getPossibleMothersBasedOnAge, getPossibleFathersBasedOnAge, getPossiblePartnersBasedOnAge, getChildren } from '../services/familyDataService';

/**
 * Normalize input text by replacing special characters with standard equivalents
 * @param {string} text - Input text to normalize
 * @returns {string} Normalized text
 */
const normalizeInput = (text) => {
    if (!text) return text;
    
    return text
        // Different apostrophe types to standard apostrophe
        .replace(/[''`´]/g, "'")
        // Common accents to base characters (for place names)
        .replace(/[éèêë]/g, 'e')
        .replace(/[áàâä]/g, 'a')
        .replace(/[íìîï]/g, 'i')
        .replace(/[óòôö]/g, 'o')
        .replace(/[úùûü]/g, 'u')
        .replace(/ñ/g, 'n')
        .replace(/ç/g, 'c')
        .replace(/[ś]/g, 's');
};

/**
 * Validate if text contains invalid characters for Latin1 charset
 * @param {string} text - Text to validate
 * @returns {boolean} True if text contains invalid characters
 */
const hasInvalidChars = (text) => {
    if (!text) return false;
    // Latin1 charset accepts: a-z, A-Z, 0-9, space, apostrophe, hyphen, period, comma, parentheses
    const validPattern = /^[a-zA-Z0-9\s'\-.,()]+$/;
    return !validPattern.test(text);
};

const formatBirthDate = (value) => {
    if (!value) return 'onbekend';

    const normalizedValue = typeof value === 'string'
        ? value.replace(/[()]/g, '').trim()
        : value;

    const date = new Date(normalizedValue);
    if (Number.isNaN(date.getTime())) {
        return 'onbekend';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
};

const buildPicklistLabel = (person, relationKey) => {
    const relationName = person?.[relationKey];
    const fallbackName = `${person?.PersonGivvenName || ''} ${person?.PersonFamilyName || ''}`.trim();
    const name = relationName || fallbackName;

    return `${name} (${formatBirthDate(person?.PersonDateOfBirth)})`;
};

/**
 * PersonAddForm Component
 * Form for adding a new person, with parent(s) pre-filled
 */
const PersonAddForm = ({ parentPerson, onAdd, onCancel }) => {
    const [formData, setFormData] = useState({
        PersonGivvenName: '',
        PersonFamilyName: '',
        PersonDateOfBirth: '',
        PersonDateOfDeath: '',
        PersonPlaceOfBirth: '',
        PersonPlaceOfDeath: '',
        FatherId: null,
        MotherId: null,
        PartnerId: null,
        PersonIsMale: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [possibleMothers, setPossibleMothers] = useState([]);
    const [isLoadingMothers, setIsLoadingMothers] = useState(false);
    const [possibleFathers, setPossibleFathers] = useState([]);
    const [isLoadingFathers, setIsLoadingFathers] = useState(false);
    const [possiblePartners, setPossiblePartners] = useState([]);
    const [isLoadingPartners, setIsLoadingPartners] = useState(false);

    // Determine if parent is father or mother based on gender
    const initializeFatherMother = () => {
        if (parentPerson) {
            if (parentPerson.PersonIsMale) {
                setFormData(prev => ({
                    ...prev,
                    FatherId: parentPerson.PersonID
                }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    MotherId: parentPerson.PersonID
                }));
            }
        }
    };

    // Initialize on component mount
    useEffect(() => {
        initializeFatherMother();
    }, [parentPerson]);

    useEffect(() => {
        const shouldFetchMothers = parentPerson?.PersonIsMale && formData.PersonDateOfBirth;
        if (!shouldFetchMothers) {
            setPossibleMothers([]);
            return;
        }

        let isCancelled = false;
        const fetchPossibleMothers = async () => {
            setIsLoadingMothers(true);
            try {
                const mothers = await getPossibleMothersBasedOnAge(formData.PersonDateOfBirth);
                if (!isCancelled) {
                    setPossibleMothers((prevMothers) => {
                        if (!formData.MotherId) {
                            return mothers;
                        }

                        const selectedMotherId = Number(formData.MotherId);
                        const hasSelectedMother = mothers.some((mother) => {
                            const motherId = mother.PossibleMotherID || mother.PersonID;
                            return Number(motherId) === selectedMotherId;
                        });

                        if (hasSelectedMother) {
                            return mothers;
                        }

                        const selectedFromPreviousList = prevMothers.find((mother) => {
                            const motherId = mother.PossibleMotherID || mother.PersonID;
                            return Number(motherId) === selectedMotherId;
                        });

                        return selectedFromPreviousList
                            ? [selectedFromPreviousList, ...mothers]
                            : mothers;
                    });
                }
            } catch (err) {
                console.error('Error loading possible mothers:', err);
                if (!isCancelled) setError(NO_CONNECTION_ERROR_TEXT);
            } finally {
                if (!isCancelled) {
                    setIsLoadingMothers(false);
                }
            }
        };

        fetchPossibleMothers();

        return () => {
            isCancelled = true;
        };
    }, [parentPerson, formData.PersonDateOfBirth, formData.MotherId]);

    useEffect(() => {
        if (!formData.PersonDateOfBirth) {
            setPossiblePartners([]);
            return;
        }

        let isCancelled = false;
        const fetchPossiblePartners = async () => {
            setIsLoadingPartners(true);
            try {
                const parentIds = [formData.FatherId, formData.MotherId].filter(Boolean);
                const childrenByParent = await Promise.all(
                    parentIds.map(parentId => getChildren(parentId))
                );
                const siblingIds = new Set(
                    childrenByParent.flat().map(child => child.PersonID)
                );
                parentIds.forEach(parentId => siblingIds.add(parentId));

                const partners = await getPossiblePartnersBasedOnAge(formData.PersonDateOfBirth);
                const birthYear = new Date(formData.PersonDateOfBirth).getFullYear();

                const filteredPartners = partners.filter(partner => {
                    const partnerId = partner.PossiblePartnerID || partner.PersonID;
                    if (!partnerId || siblingIds.has(partnerId)) return false;

                    const rawDate = partner.SortDate || partner.PersonDateOfBirth || '';
                    const normalizedDate = typeof rawDate === 'string'
                        ? rawDate.replace(/[()]/g, '')
                        : rawDate;
                    const partnerYear = normalizedDate ? new Date(normalizedDate).getFullYear() : NaN;
                    if (!Number.isFinite(partnerYear)) return false;

                    return Math.abs(partnerYear - birthYear) <= 60;
                });

                let mergedPartners = filteredPartners;
                if (formData.PartnerId) {
                    const selectedPartnerId = Number(formData.PartnerId);
                    const hasSelectedPartner = filteredPartners.some((partner) => {
                        const partnerId = partner.PossiblePartnerID || partner.PersonID;
                        return Number(partnerId) === selectedPartnerId;
                    });

                    if (!hasSelectedPartner) {
                        const selectedFromRawList = partners.find((partner) => {
                            const partnerId = partner.PossiblePartnerID || partner.PersonID;
                            return Number(partnerId) === selectedPartnerId;
                        });

                        if (selectedFromRawList) {
                            mergedPartners = [selectedFromRawList, ...filteredPartners];
                        }
                    }
                }

                if (!isCancelled) {
                    setPossiblePartners(mergedPartners);
                }
            } catch (err) {
                console.error('Error loading possible partners:', err);
                if (!isCancelled) setError(NO_CONNECTION_ERROR_TEXT);
            } finally {
                if (!isCancelled) {
                    setIsLoadingPartners(false);
                }
            }
        };

        fetchPossiblePartners();

        return () => {
            isCancelled = true;
        };
    }, [formData.PersonDateOfBirth, formData.FatherId, formData.MotherId, formData.PartnerId]);

    useEffect(() => {
        const isMother = parentPerson && (parentPerson.PersonIsMale === false || parentPerson.PersonIsMale === 0);
        const shouldFetchFathers = isMother && formData.PersonDateOfBirth;
        if (!shouldFetchFathers) {
            setPossibleFathers([]);
            return;
        }

        let isCancelled = false;
        const fetchPossibleFathers = async () => {
            setIsLoadingFathers(true);
            try {
                const fathers = await getPossibleFathersBasedOnAge(formData.PersonDateOfBirth);
                if (!isCancelled) {
                    setPossibleFathers((prevFathers) => {
                        if (!formData.FatherId) {
                            return fathers;
                        }

                        const selectedFatherId = Number(formData.FatherId);
                        const hasSelectedFather = fathers.some((father) => {
                            const fatherId = father.PossibleFatherID || father.PersonID;
                            return Number(fatherId) === selectedFatherId;
                        });

                        if (hasSelectedFather) {
                            return fathers;
                        }

                        const selectedFromPreviousList = prevFathers.find((father) => {
                            const fatherId = father.PossibleFatherID || father.PersonID;
                            return Number(fatherId) === selectedFatherId;
                        });

                        return selectedFromPreviousList
                            ? [selectedFromPreviousList, ...fathers]
                            : fathers;
                    });
                }
            } catch (err) {
                console.error('Error loading possible fathers:', err);
                if (!isCancelled) setError(NO_CONNECTION_ERROR_TEXT);
            } finally {
                if (!isCancelled) {
                    setIsLoadingFathers(false);
                }
            }
        };

        fetchPossibleFathers();

        return () => {
            isCancelled = true;
        };
    }, [parentPerson, formData.PersonDateOfBirth, formData.FatherId]);

    const handleChange = (field) => (event) => {
        let value = event.target.value;
        
        // Auto-normalize text fields (not dates)
        if (field === 'PersonGivvenName' || field === 'PersonFamilyName' || 
            field === 'PersonPlaceOfBirth' || field === 'PersonPlaceOfDeath') {
            value = normalizeInput(value);
        }
        
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.PersonGivvenName || !formData.PersonGivvenName.trim()) {
            setError('Voornaam is verplicht.');
            return;
        }
        
        if (!formData.PersonFamilyName || !formData.PersonFamilyName.trim()) {
            setError('Achternaam is verplicht.');
            return;
        }
        
        if (!formData.PersonDateOfBirth || !formData.PersonDateOfBirth.trim()) {
            setError('Geboortedatum is verplicht.');
            return;
        }
        
        if (!formData.PersonPlaceOfBirth || !formData.PersonPlaceOfBirth.trim()) {
            setError('Geboorteplaats is verplicht.');
            return;
        }
        
        // Validate for invalid characters (extra safety check)
        if (hasInvalidChars(formData.PersonGivvenName)) {
            setError('Voornaam bevat ongeldige tekens. Gebruik alleen letters, cijfers en standaard leestekens.');
            return;
        }
        
        if (hasInvalidChars(formData.PersonFamilyName)) {
            setError('Achternaam bevat ongeldige tekens. Gebruik alleen letters, cijfers en standaard leestekens.');
            return;
        }
        
        if (hasInvalidChars(formData.PersonPlaceOfBirth)) {
            setError('Geboorteplaats bevat ongeldige tekens. Gebruik alleen letters, cijfers en standaard leestekens.');
            return;
        }
        
        if (formData.PersonPlaceOfDeath && hasInvalidChars(formData.PersonPlaceOfDeath)) {
            setError('Plaats van overlijden bevat ongeldige tekens. Gebruik alleen letters, cijfers en standaard leestekens.');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            // Prepare data with proper null handling for dates
            const personIsMaleValue = formData.PersonIsMale === '' ? null : Number(formData.PersonIsMale);
            const personData = {
                PersonGivvenName: formData.PersonGivvenName.trim(),
                PersonFamilyName: formData.PersonFamilyName.trim(),
                PersonDateOfBirth: formData.PersonDateOfBirth || null,
                PersonDateOfDeath: formData.PersonDateOfDeath || null,
                PersonPlaceOfBirth: formData.PersonPlaceOfBirth || null,
                PersonPlaceOfDeath: formData.PersonPlaceOfDeath || null,
                FatherId: formData.FatherId || null,
                MotherId: formData.MotherId || null,
                PartnerId: formData.PartnerId || null,
                PersonIsMale: personIsMaleValue,
            };
            
            const result = await addPerson(personData);
            if (result?.success && result.person) {
                if (onAdd) {
                    onAdd(result.person);
                }
            } else {
                setError(result?.error || 'Toevoegen mislukt. Probeer het opnieuw.');
            }
        } catch (err) {
            setError('Er is een fout opgetreden bij het toevoegen.');
            console.error('Error adding person:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelClick = () => {
        if (onCancel) {
            onCancel();
        }
    };

    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: 3,
                width: '100%',
            }}
        >
            <Typography variant="h6" gutterBottom>
                Persoon Toevoegen
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>
            )}

            <TextField
                label="Voornaam"
                value={formData.PersonGivvenName}
                onChange={handleChange('PersonGivvenName')}
                fullWidth
                required
                disabled={isSaving}
            />

            <TextField
                label="Achternaam"
                value={formData.PersonFamilyName}
                onChange={handleChange('PersonFamilyName')}
                fullWidth
                required
                disabled={isSaving}
            />

            <TextField
                label="Geboortedatum"
                type="date"
                value={formData.PersonDateOfBirth}
                onChange={handleChange('PersonDateOfBirth')}
                fullWidth
                required
                disabled={isSaving}
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: new Date().toISOString().split('T')[0] }}
            />

            <TextField
                label="Geboorteplaats"
                value={formData.PersonPlaceOfBirth}
                onChange={handleChange('PersonPlaceOfBirth')}
                fullWidth
                required
                disabled={isSaving}
            />

            <TextField
                label="Overlijdensdatum"
                type="date"
                value={formData.PersonDateOfDeath}
                onChange={handleChange('PersonDateOfDeath')}
                fullWidth
                disabled={isSaving}
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: new Date().toISOString().split('T')[0] }}
            />

            <TextField
                label="Plaats van overlijden"
                value={formData.PersonPlaceOfDeath}
                onChange={handleChange('PersonPlaceOfDeath')}
                fullWidth
                disabled={isSaving}
            />

            <FormControl component="fieldset" disabled={isSaving}>
                <FormLabel component="legend">Geslacht</FormLabel>
                <RadioGroup
                    row
                    value={formData.PersonIsMale}
                    onChange={handleChange('PersonIsMale')}
                >
                    <FormControlLabel value="" control={<Radio />} label="Onbekend" />
                    <FormControlLabel value="1" control={<Radio />} label="Man" />
                    <FormControlLabel value="0" control={<Radio />} label="Vrouw" />
                </RadioGroup>
            </FormControl>

            {parentPerson?.PersonIsMale ? (
                <>
                    <TextField
                        label="Vader"
                        value={parentPerson ? `${parentPerson.PersonGivvenName || ''} ${parentPerson.PersonFamilyName || ''}`.trim() : ''}
                        fullWidth
                        disabled
                        helperText="Automatisch ingesteld"
                    />
                    <TextField
                        label="Moeder"
                        value={formData.MotherId || ''}
                        onChange={handleChange('MotherId')}
                        select
                        fullWidth
                        disabled={isSaving || isLoadingMothers || !formData.PersonDateOfBirth}
                        helperText={
                            formData.PersonDateOfBirth
                                ? 'Kies een moeder (15-50 jaar ouder)'
                                : 'Vul eerst de geboortedatum van het kind in'
                        }
                    >
                        <MenuItem value="">
                            Geen selectie
                        </MenuItem>
                        {possibleMothers.map((mother) => (
                            <MenuItem key={mother.PossibleMotherID || mother.PersonID} value={mother.PossibleMotherID || mother.PersonID}>
                                {buildPicklistLabel(mother, 'PossibleMother')}
                            </MenuItem>
                        ))}
                    </TextField>
                </>
            ) : parentPerson ? (
                <>
                    <TextField
                        label="Moeder"
                        value={parentPerson ? `${parentPerson.PersonGivvenName || ''} ${parentPerson.PersonFamilyName || ''}`.trim() : ''}
                        fullWidth
                        disabled
                        helperText="Automatisch ingesteld"
                    />
                    <TextField
                        label="Vader"
                        value={formData.FatherId || ''}
                        onChange={handleChange('FatherId')}
                        select
                        fullWidth
                        disabled={isSaving || isLoadingFathers || !formData.PersonDateOfBirth}
                        helperText={
                            formData.PersonDateOfBirth
                                ? 'Kies een vader (15-50 jaar ouder)'
                                : 'Vul eerst de geboortedatum van het kind in'
                        }
                    >
                        <MenuItem value="">
                            Geen selectie
                        </MenuItem>
                        {possibleFathers.map((father) => (
                            <MenuItem key={father.PossibleFatherID || father.PersonID} value={father.PossibleFatherID || father.PersonID}>
                                {buildPicklistLabel(father, 'PossibleFather')}
                            </MenuItem>
                        ))}
                    </TextField>
                </>
            ) : (
                <>
                    <TextField
                        label="Vader"
                        value={formData.FatherId || ''}
                        type="number"
                        fullWidth
                        disabled
                        helperText="Automatisch ingesteld"
                    />
                    <TextField
                        label="Moeder"
                        value={formData.MotherId || ''}
                        type="number"
                        fullWidth
                        disabled
                        helperText="Automatisch ingesteld"
                    />
                </>
            )}

            <TextField
                label="Partner"
                value={formData.PartnerId || ''}
                onChange={handleChange('PartnerId')}
                select
                fullWidth
                disabled={isSaving || isLoadingPartners || !formData.PersonDateOfBirth}
                helperText={
                    formData.PersonDateOfBirth
                        ? 'Kies een partner (max 60 jaar leeftijdsverschil)'
                        : 'Vul eerst de geboortedatum van de persoon in'
                }
            >
                <MenuItem value="">
                    Geen selectie
                </MenuItem>
                {possiblePartners.map((partner) => (
                    <MenuItem key={partner.PossiblePartnerID || partner.PersonID} value={partner.PossiblePartnerID || partner.PersonID}>
                        {buildPicklistLabel(partner, 'PossiblePartner')}
                    </MenuItem>
                ))}
            </TextField>

            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    disabled={isSaving}
                >
                    {isSaving ? 'Bewaren...' : 'Bewaren'}
                </Button>
                <Button
                    variant="outlined"
                    color="secondary"
                    fullWidth
                    onClick={handleCancelClick}
                    disabled={isSaving}
                >
                    Annuleren
                </Button>
            </Box>
        </Box>
    );
};

PersonAddForm.propTypes = {
    parentPerson: PropTypes.shape({
        PersonID: PropTypes.number.isRequired,
        PersonGivvenName: PropTypes.string,
        PersonFamilyName: PropTypes.string,
        PersonIsMale: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
    }),
    onAdd: PropTypes.func,
    onCancel: PropTypes.func,
};

export default PersonAddForm;
