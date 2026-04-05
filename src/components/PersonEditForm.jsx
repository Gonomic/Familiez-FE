import { useState, useEffect } from 'react';
import { Alert, Box, TextField, Button, Typography, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, MenuItem } from '@mui/material';
import { NO_CONNECTION_ERROR_TEXT } from '../constants/errorMessages';
import PropTypes from 'prop-types';
import { updatePerson, getPossibleMothersBasedOnAge, getPossibleFathersBasedOnAge, getPossiblePartnersBasedOnAge, getFather, getMother, getPartners, getChildren } from '../services/familyDataService';

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
 * PersonEditForm Component
 * Form for editing person details in the right drawer
 */
const PersonEditForm = ({ person, onSave, onCancel }) => {
    const LOADING_OPTION_VALUE = '__loading__';
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
    const [loadingDots, setLoadingDots] = useState(1);

    useEffect(() => {
        const isAnyRelationLoading = isLoadingFathers || isLoadingMothers || isLoadingPartners;
        if (!isAnyRelationLoading) {
            setLoadingDots(1);
            return undefined;
        }

        const intervalId = setInterval(() => {
            setLoadingDots((prev) => (prev >= 3 ? 1 : prev + 1));
        }, 450);

        return () => clearInterval(intervalId);
    }, [isLoadingFathers, isLoadingMothers, isLoadingPartners]);

    // Load person data and current relations
    useEffect(() => {
        if (person) {
            setFormData({
                PersonGivvenName: person.PersonGivvenName || '',
                PersonFamilyName: person.PersonFamilyName || '',
                PersonDateOfBirth: person.PersonDateOfBirth || '',
                PersonDateOfDeath: person.PersonDateOfDeath || '',
                PersonPlaceOfBirth: person.PersonPlaceOfBirth || '',
                PersonPlaceOfDeath: person.PersonPlaceOfDeath || '',
                FatherId: null,
                MotherId: null,
                PartnerId: null,
                PersonIsMale: person.PersonIsMale === null || person.PersonIsMale === undefined ? '' : String(person.PersonIsMale),
            });

            // Load current relations
            const loadRelations = async () => {
                try {
                    const [fatherId, motherId, partners] = await Promise.all([
                        getFather(person.PersonID, { throwOnError: true }),
                        getMother(person.PersonID, { throwOnError: true }),
                        getPartners(person.PersonID, { throwOnError: true })
                    ]);

                    setFormData(prev => ({
                        ...prev,
                        FatherId: fatherId || null,
                        MotherId: motherId || null,
                        PartnerId: partners && partners.length > 0 ? partners[0].PersonID : null
                    }));
                } catch (err) {
                    console.error('Error loading relations:', err);
                    setError(NO_CONNECTION_ERROR_TEXT);
                }
            };

            loadRelations();
        }
    }, [person]);

    // Fetch possible mothers based on birth date
    useEffect(() => {
        if (!formData.PersonDateOfBirth) {
            setPossibleMothers([]);
            return;
        }

        let isCancelled = false;
        const fetchPossibleMothers = async () => {
            setIsLoadingMothers(true);
            try {
                const mothers = await getPossibleMothersBasedOnAge(formData.PersonDateOfBirth, { throwOnError: true });
                if (!isCancelled) {
                    setPossibleMothers(mothers);
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
    }, [formData.PersonDateOfBirth]);

    // Fetch possible fathers based on birth date
    useEffect(() => {
        if (!formData.PersonDateOfBirth) {
            setPossibleFathers([]);
            return;
        }

        let isCancelled = false;
        const fetchPossibleFathers = async () => {
            setIsLoadingFathers(true);
            try {
                const fathers = await getPossibleFathersBasedOnAge(formData.PersonDateOfBirth, { throwOnError: true });
                if (!isCancelled) {
                    setPossibleFathers(fathers);
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
    }, [formData.PersonDateOfBirth]);

    // Fetch possible partners based on birth date
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
                    parentIds.map(parentId => getChildren(parentId, { throwOnError: true }))
                );
                const siblingIds = new Set(
                    childrenByParent.flat().map(child => child.PersonID)
                );
                parentIds.forEach(parentId => siblingIds.add(parentId));

                const partners = await getPossiblePartnersBasedOnAge(formData.PersonDateOfBirth, { throwOnError: true });
                const birthYear = new Date(formData.PersonDateOfBirth).getFullYear();

                const filteredPartners = partners.filter(partner => {
                    const partnerId = partner.PossiblePartnerID || partner.PersonID;
                    if (!partnerId || siblingIds.has(partnerId) || partnerId === person?.PersonID) return false;

                    const rawDate = partner.SortDate || partner.PersonDateOfBirth || '';
                    const normalizedDate = typeof rawDate === 'string'
                        ? rawDate.replace(/[()]/g, '')
                        : rawDate;
                    const partnerYear = normalizedDate ? new Date(normalizedDate).getFullYear() : NaN;
                    if (!Number.isFinite(partnerYear)) return false;

                    return Math.abs(partnerYear - birthYear) <= 60;
                });

                if (!isCancelled) {
                    setPossiblePartners(filteredPartners);
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
    }, [formData.PersonDateOfBirth, formData.FatherId, formData.MotherId, person]);

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
        
        // Validate for invalid characters
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
            // Prepare data with all fields including relations and gender
            const personIsMaleValue = formData.PersonIsMale === '' ? null : Number(formData.PersonIsMale);
            const updateData = {
                PersonGivvenName: formData.PersonGivvenName,
                PersonFamilyName: formData.PersonFamilyName,
                PersonDateOfBirth: formData.PersonDateOfBirth || null,
                PersonPlaceOfBirth: formData.PersonPlaceOfBirth || null,
                PersonDateOfDeath: formData.PersonDateOfDeath || null,
                PersonPlaceOfDeath: formData.PersonPlaceOfDeath || null,
                PersonIsMale: personIsMaleValue,
                FatherId: formData.FatherId || null,
                MotherId: formData.MotherId || null,
                PartnerId: formData.PartnerId || null,
            };

            const success = await updatePerson(person.PersonID, updateData);
            if (success) {
                if (onSave) {
                    onSave({ ...person, ...updateData });
                }
            } else {
                setError('Opslaan mislukt. Probeer het opnieuw.');
            }
        } catch (err) {
            setError('Er is een fout opgetreden bij het opslaan.');
            console.error('Error saving person:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelClick = () => {
        if (onCancel) {
            onCancel();
        }
    };

    if (!person) {
        return null;
    }

    const loadingText = `Gegevens worden opgehaald${'.'.repeat(loadingDots)}`;

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
                Persoon Bewerken
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
            />

            <TextField
                label="Achternaam"
                value={formData.PersonFamilyName}
                onChange={handleChange('PersonFamilyName')}
                fullWidth
                required
            />

            <TextField
                label="Geboortedatum"
                type="date"
                value={formData.PersonDateOfBirth}
                onChange={handleChange('PersonDateOfBirth')}
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: new Date().toISOString().split('T')[0] }}
            />

            <TextField
                label="Geboorteplaats"
                value={formData.PersonPlaceOfBirth}
                onChange={handleChange('PersonPlaceOfBirth')}
                fullWidth
            />

            <TextField
                label="Overlijdensdatum"
                type="date"
                value={formData.PersonDateOfDeath}
                onChange={handleChange('PersonDateOfDeath')}
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: new Date().toISOString().split('T')[0] }}
            />

            <TextField
                label="Plaats van overlijden"
                value={formData.PersonPlaceOfDeath}
                onChange={handleChange('PersonPlaceOfDeath')}
                fullWidth
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

            <TextField
                label="Vader"
                value={isLoadingFathers ? LOADING_OPTION_VALUE : (formData.FatherId || '')}
                onChange={handleChange('FatherId')}
                select
                SelectProps={{ displayEmpty: true }}
                fullWidth
                disabled={isSaving || isLoadingFathers || !formData.PersonDateOfBirth}
                helperText={
                    isLoadingFathers
                        ? loadingText
                        : formData.PersonDateOfBirth
                        ? 'Kies een vader (15-50 jaar ouder)'
                        : 'Vul eerst de geboortedatum in'
                }
            >
                {isLoadingFathers && (
                    <MenuItem value={LOADING_OPTION_VALUE}>
                        {loadingText}
                    </MenuItem>
                )}
                <MenuItem value="">
                    Vader onbekend, kies er een
                </MenuItem>
                {possibleFathers.map((father) => (
                    <MenuItem key={father.PossibleFatherID || father.PersonID} value={father.PossibleFatherID || father.PersonID}>
                        {buildPicklistLabel(father, 'PossibleFather')}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                label="Moeder"
                value={isLoadingMothers ? LOADING_OPTION_VALUE : (formData.MotherId || '')}
                onChange={handleChange('MotherId')}
                select
                SelectProps={{ displayEmpty: true }}
                fullWidth
                disabled={isSaving || isLoadingMothers || !formData.PersonDateOfBirth}
                helperText={
                    isLoadingMothers
                        ? loadingText
                        : formData.PersonDateOfBirth
                        ? 'Kies een moeder (15-50 jaar ouder)'
                        : 'Vul eerst de geboortedatum in'
                }
            >
                {isLoadingMothers && (
                    <MenuItem value={LOADING_OPTION_VALUE}>
                        {loadingText}
                    </MenuItem>
                )}
                <MenuItem value="">
                    Moeder onbekend, kies er een
                </MenuItem>
                {possibleMothers.map((mother) => (
                    <MenuItem key={mother.PossibleMotherID || mother.PersonID} value={mother.PossibleMotherID || mother.PersonID}>
                        {buildPicklistLabel(mother, 'PossibleMother')}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                label="Partner"
                value={isLoadingPartners ? LOADING_OPTION_VALUE : (formData.PartnerId || '')}
                onChange={handleChange('PartnerId')}
                select
                SelectProps={{ displayEmpty: true }}
                fullWidth
                disabled={isSaving || isLoadingPartners || !formData.PersonDateOfBirth}
                helperText={
                    isLoadingPartners
                        ? loadingText
                        : formData.PersonDateOfBirth
                        ? 'Kies een partner (max 60 jaar leeftijdsverschil)'
                        : 'Vul eerst de geboortedatum in'
                }
            >
                {isLoadingPartners && (
                    <MenuItem value={LOADING_OPTION_VALUE}>
                        {loadingText}
                    </MenuItem>
                )}
                <MenuItem value="">
                    Partner onbekend, kies er een
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
                    {isSaving ? 'Opslaan...' : 'Opslaan'}
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

PersonEditForm.propTypes = {
    person: PropTypes.shape({
        PersonID: PropTypes.number.isRequired,
        PersonGivvenName: PropTypes.string,
        PersonFamilyName: PropTypes.string,
        PersonDateOfBirth: PropTypes.string,
        PersonDateOfDeath: PropTypes.string,
        PersonPlaceOfBirth: PropTypes.string,
        PersonPlaceOfDeath: PropTypes.string,
    }),
    onSave: PropTypes.func,
    onCancel: PropTypes.func,
};

export default PersonEditForm;
