import { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, MenuItem } from '@mui/material';
import PropTypes from 'prop-types';
import { addPerson, getPossibleMothersBasedOnAge, getPossibleFathersBasedOnAge, getPossiblePartnersBasedOnAge, getChildren } from '../services/familyDataService';

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
                    setPossibleMothers(mothers);
                }
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
    }, [parentPerson, formData.PersonDateOfBirth]);

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

                if (!isCancelled) {
                    setPossiblePartners(filteredPartners);
                }
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
    }, [formData.PersonDateOfBirth, formData.FatherId, formData.MotherId]);

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
                    setPossibleFathers(fathers);
                }
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
    }, [parentPerson, formData.PersonDateOfBirth]);

    const handleChange = (field) => (event) => {
        setFormData(prev => ({
            ...prev,
            [field]: event.target.value
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
        
        if (!formData.PersonPlaceOfBirth || !formData.PersonPlaceOfBirth.trim()) {
            setError('Geboorteplaats is verplicht.');
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
                <Typography color="error" variant="body2">
                    {error}
                </Typography>
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
                                {mother.PossibleMother || `${mother.PersonGivvenName || ''} ${mother.PersonFamilyName || ''}`.trim()}
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
                                {father.PossibleFather || `${father.PersonGivvenName || ''} ${father.PersonFamilyName || ''}`.trim()}
                            </MenuItem>
                        ))}
                    </TextField>
                </>
            ) : (
                <>
                    <TextField
                        label="Vader ID"
                        value={formData.FatherId || ''}
                        type="number"
                        fullWidth
                        disabled
                        helperText="Automatisch ingesteld"
                    />
                    <TextField
                        label="Moeder ID"
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
                        {partner.PossiblePartner || `${partner.PersonGivvenName || ''} ${partner.PersonFamilyName || ''}`.trim()}
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
                    Afbreken
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
