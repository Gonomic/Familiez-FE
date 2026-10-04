import { useEffect, useState } from 'react';
import { Alert, Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import PropTypes from 'prop-types';
import {
    addNewParentToChild,
    getFather,
    getMother,
    getPersonDetails,
    getPossiblePartnersBasedOnAge,
} from '../services/familyDataService';

const getPartnerId = (partner) => partner.PossiblePartnerID || partner.PersonID;

const formatPartnerLabel = (partner) => {
    const name = partner.PossiblePartner
        || `${partner.PersonGivvenName || ''} ${partner.PersonFamilyName || ''}`.trim();
    const dateOfBirth = String(partner.PersonDateOfBirth || '').slice(0, 10);
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
    const formattedDate = dateParts
        ? `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}`
        : dateOfBirth;
    return formattedDate ? `${name} (${formattedDate})` : name;
};

const ParentAddForm = ({ childPerson, parentRole, onAdd, onCancel }) => {
    const parentLabel = parentRole === 'father' ? 'Vader' : 'Moeder';
    const gender = parentRole === 'father' ? 1 : 0;
    const [formData, setFormData] = useState({
        givenName: '',
        familyName: '',
        birthDate: '',
        birthPlace: '',
        deathDate: '',
        deathPlace: '',
        partnerId: '',
        marriageDate: '',
        marriagePlace: '',
    });
    const [possiblePartners, setPossiblePartners] = useState([]);
    const [isLoadingPartners, setIsLoadingPartners] = useState(false);
    const [partnerLookupError, setPartnerLookupError] = useState('');
    const [existingParent, setExistingParent] = useState(null);
    const [isCheckingParent, setIsCheckingParent] = useState(true);
    const [parentLookupError, setParentLookupError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [savedResult, setSavedResult] = useState(null);

    useEffect(() => {
        let isCancelled = false;
        const loadExistingParent = async () => {
            setIsCheckingParent(true);
            setParentLookupError('');
            setExistingParent(null);
            try {
                const getParentId = parentRole === 'father' ? getFather : getMother;
                const parentId = await getParentId(childPerson.PersonID, { throwOnError: true });
                const parent = parentId
                    ? await getPersonDetails(parentId, { throwOnError: true })
                    : null;
                if (!isCancelled) {
                    setExistingParent(parent || (parentId ? { PersonID: parentId } : null));
                }
            } catch (lookupError) {
                if (!isCancelled) {
                    setParentLookupError(lookupError.message || `De bestaande ${parentLabel.toLowerCase()} kon niet worden gecontroleerd.`);
                }
            } finally {
                if (!isCancelled) {
                    setIsCheckingParent(false);
                }
            }
        };

        loadExistingParent();
        return () => {
            isCancelled = true;
        };
    }, [childPerson.PersonID, parentLabel, parentRole]);

    useEffect(() => {
        if (!formData.birthDate) {
            setPossiblePartners([]);
            setPartnerLookupError('');
            return undefined;
        }

        let isCancelled = false;
        const loadPartners = async () => {
            setIsLoadingPartners(true);
            setPartnerLookupError('');
            try {
                const partners = await getPossiblePartnersBasedOnAge(formData.birthDate, { throwOnError: true });
                if (!isCancelled) {
                    setPossiblePartners(
                        partners.filter((partner) => Number(getPartnerId(partner)) !== Number(childPerson?.PersonID))
                    );
                }
            } catch (lookupError) {
                if (!isCancelled) {
                    setPossiblePartners([]);
                    setPartnerLookupError(lookupError.message || 'Mogelijke partners konden niet worden opgehaald.');
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingPartners(false);
                }
            }
        };

        loadPartners();
        return () => {
            isCancelled = true;
        };
    }, [childPerson?.PersonID, formData.birthDate]);

    const handleChange = (field) => (event) => {
        const value = event.target.value;
        setFormData((previous) => ({
            ...previous,
            [field]: value,
            ...(field === 'partnerId' && !value ? { marriageDate: '', marriagePlace: '' } : {}),
        }));
        setError('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (isCheckingParent || existingParent || parentLookupError) {
            return;
        }
        if (!childPerson?.PersonID) {
            setError('De geselecteerde persoon kon niet worden bepaald.');
            return;
        }
        if (!formData.givenName.trim() || !formData.familyName.trim() || !formData.birthDate || !formData.birthPlace.trim()) {
            setError('Vul voornaam, achternaam, geboortedatum en geboorteplaats in.');
            return;
        }
        if (formData.deathDate && formData.deathDate < formData.birthDate) {
            setError('Overlijdensdatum kan niet voor de geboortedatum liggen.');
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            const result = await addNewParentToChild({
                kindId: childPerson.PersonID,
                gender,
                givenName: formData.givenName.trim(),
                familyName: formData.familyName.trim(),
                birthDate: formData.birthDate,
                birthPlace: formData.birthPlace.trim(),
                deathDate: formData.deathDate || null,
                deathPlace: formData.deathPlace.trim() || null,
                partnerId: formData.partnerId ? Number(formData.partnerId) : null,
                marriageDate: formData.partnerId ? formData.marriageDate || null : null,
                marriagePlace: formData.partnerId ? formData.marriagePlace.trim() || null : null,
            });

            if (!result?.success) {
                setError(result?.error || 'Toevoegen mislukt. Probeer het opnieuw.');
                return;
            }

            setSavedResult({
                personId: result.personId,
                warning: result.warning || null,
            });
            if (onAdd) {
                onAdd({ PersonID: result.personId });
            }
        } catch (submitError) {
            setError(submitError.message || 'Er is een fout opgetreden bij het toevoegen.');
        } finally {
            setIsSaving(false);
        }
    };

    const today = new Date().toISOString().slice(0, 10);
    const isDisabled = isSaving || Boolean(savedResult) || isCheckingParent || Boolean(existingParent) || Boolean(parentLookupError);
    const existingParentName = `${existingParent?.PersonGivvenName || ''} ${existingParent?.PersonFamilyName || ''}`.trim();

    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, width: '100%' }}
        >
            <Typography variant="h6">{parentLabel} toevoegen</Typography>
            <Typography variant="body2" color="text.secondary">
                Voor: {childPerson?.PersonGivvenName} {childPerson?.PersonFamilyName}
            </Typography>

            {error && <Alert severity="error">{error}</Alert>}
            {isCheckingParent && <Typography variant="body2">Bestaande ouder controleren...</Typography>}
            {existingParent && (
                <Alert severity="warning">
                    Er is al een {parentLabel.toLowerCase()} gekoppeld
                    {existingParentName ? `: ${existingParentName}.` : ` (ID ${existingParent.PersonID}).`}
                    {' '}Deze relatie blijft ongewijzigd.
                </Alert>
            )}
            {parentLookupError && <Alert severity="error">{parentLookupError}</Alert>}
            {savedResult && (
                <Alert severity={savedResult.warning ? 'warning' : 'success'}>
                    {savedResult.warning || `${parentLabel} is toegevoegd.`}
                </Alert>
            )}
            {partnerLookupError && <Alert severity="warning">{partnerLookupError}</Alert>}

            <TextField
                label="Voornaam"
                value={formData.givenName}
                onChange={handleChange('givenName')}
                inputProps={{ maxLength: 25 }}
                required
                fullWidth
                disabled={isDisabled}
            />
            <TextField
                label="Achternaam"
                value={formData.familyName}
                onChange={handleChange('familyName')}
                inputProps={{ maxLength: 50 }}
                required
                fullWidth
                disabled={isDisabled}
            />
            <TextField
                label="Geboortedatum"
                type="date"
                value={formData.birthDate}
                onChange={handleChange('birthDate')}
                inputProps={{ max: today }}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
                disabled={isDisabled}
            />
            <TextField
                label="Geboorteplaats"
                value={formData.birthPlace}
                onChange={handleChange('birthPlace')}
                inputProps={{ maxLength: 50 }}
                required
                fullWidth
                disabled={isDisabled}
            />
            <TextField
                label="Overlijdensdatum"
                type="date"
                value={formData.deathDate}
                onChange={handleChange('deathDate')}
                inputProps={{ max: today }}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled={isDisabled}
            />
            <TextField
                label="Plaats van overlijden"
                value={formData.deathPlace}
                onChange={handleChange('deathPlace')}
                inputProps={{ maxLength: 80 }}
                fullWidth
                disabled={isDisabled}
            />
            <TextField
                select
                label="Partner (optioneel)"
                value={formData.partnerId}
                onChange={handleChange('partnerId')}
                helperText={formData.birthDate ? 'Kies een bestaande partner om de andere ouderrelatie vast te leggen.' : 'Vul eerst de geboortedatum in.'}
                fullWidth
                disabled={isDisabled || isLoadingPartners || !formData.birthDate}
            >
                <MenuItem value="">Geen partner toevoegen</MenuItem>
                {possiblePartners.map((partner) => (
                    <MenuItem key={getPartnerId(partner)} value={getPartnerId(partner)}>
                        {formatPartnerLabel(partner)}
                    </MenuItem>
                ))}
            </TextField>
            {formData.partnerId && (
                <>
                    <TextField
                        label="Huwelijksdatum"
                        type="date"
                        value={formData.marriageDate}
                        onChange={handleChange('marriageDate')}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                        disabled={isDisabled}
                    />
                    <TextField
                        label="Huwelijksplaats"
                        value={formData.marriagePlace}
                        onChange={handleChange('marriagePlace')}
                        inputProps={{ maxLength: 100 }}
                        fullWidth
                        disabled={isDisabled}
                    />
                </>
            )}

            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                {savedResult ? (
                    <Button variant="contained" fullWidth onClick={onCancel}>
                        Sluiten
                    </Button>
                ) : (
                    <>
                        <Button type="submit" variant="contained" fullWidth disabled={isDisabled}>
                            {isSaving ? 'Bewaren...' : 'Bewaren'}
                        </Button>
                        <Button variant="outlined" fullWidth onClick={onCancel} disabled={isSaving}>
                            Annuleren
                        </Button>
                    </>
                )}
            </Box>
        </Box>
    );
};

ParentAddForm.propTypes = {
    childPerson: PropTypes.shape({
        PersonID: PropTypes.number.isRequired,
        PersonGivvenName: PropTypes.string,
        PersonFamilyName: PropTypes.string,
    }).isRequired,
    parentRole: PropTypes.oneOf(['father', 'mother']).isRequired,
    onAdd: PropTypes.func,
    onCancel: PropTypes.func.isRequired,
};

export default ParentAddForm;