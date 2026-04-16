import { useState, useEffect } from 'react';
import { Alert, Box, TextField, Button, Typography, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { NO_CONNECTION_ERROR_TEXT } from '../constants/errorMessages';
import PropTypes from 'prop-types';
import { updatePerson, createMarriage, endMarriage, updateMarriageStartDate, getActiveMarriageForPerson, getPossibleMothersBasedOnAge, getPossibleFathersBasedOnAge, getPossiblePartnersBasedOnAge, getFather, getMother, getPartners, getChildren, getPersonDetails } from '../services/familyDataService';

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

const MARRIAGE_END_REASONS = [
    { value: 'scheiding', label: 'Scheiding' },
    { value: 'overlijden_een_partner', label: 'Overlijden van een partner' },
    { value: 'overlijden_beide_partners', label: 'Overlijden van beide partners' },
    { value: 'onbekend', label: 'Onbekend' },
];

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
        MarriageStartDate: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [initialUpdateData, setInitialUpdateData] = useState(null);
    const [possibleMothers, setPossibleMothers] = useState([]);
    const [isLoadingMothers, setIsLoadingMothers] = useState(false);
    const [possibleFathers, setPossibleFathers] = useState([]);
    const [isLoadingFathers, setIsLoadingFathers] = useState(false);
    const [currentFatherOption, setCurrentFatherOption] = useState(null);
    const [currentMotherOption, setCurrentMotherOption] = useState(null);
    const [possiblePartners, setPossiblePartners] = useState([]);
    const [isLoadingPartners, setIsLoadingPartners] = useState(false);
    const [currentPartnerOption, setCurrentPartnerOption] = useState(null);
    const [loadingDots, setLoadingDots] = useState(1);
    const [existingActiveMarriage, setExistingActiveMarriage] = useState(null);
    const [endMarriageDialogOpen, setEndMarriageDialogOpen] = useState(false);
    const [endMarriageDate, setEndMarriageDate] = useState('');
    const [endMarriageReason, setEndMarriageReason] = useState('scheiding');
    const [endMarriageError, setEndMarriageError] = useState('');
    const [isEndingMarriage, setIsEndingMarriage] = useState(false);
    const [endMarriagePartialWarning, setEndMarriagePartialWarning] = useState('');
    const [pendingPartnerClear, setPendingPartnerClear] = useState(null);

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
            setCurrentFatherOption(null);
            setCurrentMotherOption(null);
            setCurrentPartnerOption(null);
            setInitialUpdateData(null);
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
                MarriageStartDate: '',
            });

            // Load current relations
            const loadRelations = async () => {
                try {
                    const [fatherId, motherId, partners, activeMarriage] = await Promise.all([
                        getFather(person.PersonID, { throwOnError: true }),
                        getMother(person.PersonID, { throwOnError: true }),
                        getPartners(person.PersonID, { throwOnError: true }),
                        getActiveMarriageForPerson(person.PersonID),
                    ]);

                    const [fatherDetails, motherDetails] = await Promise.all([
                        fatherId ? getPersonDetails(fatherId, { throwOnError: true }) : Promise.resolve(null),
                        motherId ? getPersonDetails(motherId, { throwOnError: true }) : Promise.resolve(null),
                    ]);

                    setFormData(prev => ({
                        ...prev,
                        FatherId: fatherId || null,
                        MotherId: motherId || null,
                        PartnerId: partners && partners.length > 0 ? partners[0].PersonID : null,
                        MarriageStartDate: activeMarriage?.StartDate ? String(activeMarriage.StartDate).slice(0, 10) : '',
                    }));

                    setCurrentFatherOption(fatherDetails || null);
                    setCurrentMotherOption(motherDetails || null);
                    setCurrentPartnerOption(partners && partners.length > 0 ? partners[0] : null);
                    setExistingActiveMarriage(activeMarriage || null);

                    const initialPersonIsMaleValue = person.PersonIsMale === '' || person.PersonIsMale === null || person.PersonIsMale === undefined
                        ? null
                        : Number(person.PersonIsMale);
                    setInitialUpdateData({
                        PersonGivvenName: person.PersonGivvenName || '',
                        PersonFamilyName: person.PersonFamilyName || '',
                        PersonDateOfBirth: person.PersonDateOfBirth || '',
                        PersonPlaceOfBirth: person.PersonPlaceOfBirth || '',
                        PersonDateOfDeath: person.PersonDateOfDeath || null,
                        PersonPlaceOfDeath: person.PersonPlaceOfDeath || null,
                        PersonIsMale: initialPersonIsMaleValue,
                        FatherId: fatherId || null,
                        MotherId: motherId || null,
                        PartnerId: partners && partners.length > 0 ? partners[0].PersonID : null,
                    });
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

                let mergedMothers = mothers;
                if (formData.MotherId && currentMotherOption?.PersonID) {
                    const selectedMotherId = Number(formData.MotherId);
                    const hasSelectedMother = mothers.some((mother) => {
                        const motherId = mother.PossibleMotherID || mother.PersonID;
                        return Number(motherId) === selectedMotherId;
                    });

                    if (!hasSelectedMother && Number(currentMotherOption.PersonID) === selectedMotherId) {
                        const currentMotherAsOption = {
                            ...currentMotherOption,
                            PossibleMotherID: currentMotherOption.PersonID,
                            PossibleMother: `${currentMotherOption.PersonGivvenName || ''} ${currentMotherOption.PersonFamilyName || ''}`.trim(),
                            SortDate: currentMotherOption.PersonDateOfBirth || null,
                        };
                        mergedMothers = [currentMotherAsOption, ...mothers];
                    }
                }

                if (!isCancelled) {
                    setPossibleMothers(mergedMothers);
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
    }, [formData.PersonDateOfBirth, formData.MotherId, currentMotherOption]);

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

                let mergedFathers = fathers;
                if (formData.FatherId && currentFatherOption?.PersonID) {
                    const selectedFatherId = Number(formData.FatherId);
                    const hasSelectedFather = fathers.some((father) => {
                        const fatherId = father.PossibleFatherID || father.PersonID;
                        return Number(fatherId) === selectedFatherId;
                    });

                    if (!hasSelectedFather && Number(currentFatherOption.PersonID) === selectedFatherId) {
                        const currentFatherAsOption = {
                            ...currentFatherOption,
                            PossibleFatherID: currentFatherOption.PersonID,
                            PossibleFather: `${currentFatherOption.PersonGivvenName || ''} ${currentFatherOption.PersonFamilyName || ''}`.trim(),
                            SortDate: currentFatherOption.PersonDateOfBirth || null,
                        };
                        mergedFathers = [currentFatherAsOption, ...fathers];
                    }
                }

                if (!isCancelled) {
                    setPossibleFathers(mergedFathers);
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
    }, [formData.PersonDateOfBirth, formData.FatherId, currentFatherOption]);

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

                let mergedPartners = filteredPartners;
                if (currentPartnerOption?.PersonID) {
                    const hasCurrentPartner = filteredPartners.some((partner) => {
                        const partnerId = partner.PossiblePartnerID || partner.PersonID;
                        return partnerId === currentPartnerOption.PersonID;
                    });

                    if (!hasCurrentPartner) {
                        const currentPartnerAsOption = {
                            ...currentPartnerOption,
                            PossiblePartnerID: currentPartnerOption.PersonID,
                            PossiblePartner: `${currentPartnerOption.PersonGivvenName || ''} ${currentPartnerOption.PersonFamilyName || ''}`.trim(),
                            SortDate: currentPartnerOption.PersonDateOfBirth || null,
                        };
                        mergedPartners = [currentPartnerAsOption, ...filteredPartners];
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
    }, [formData.PersonDateOfBirth, formData.FatherId, formData.MotherId, person, currentPartnerOption]);

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

        const selectedPartnerId = formData.PartnerId ? Number(formData.PartnerId) : null;
        const existingMarriagePartnerId = existingActiveMarriage?.PartnerID
            ? Number(existingActiveMarriage.PartnerID)
            : null;
        const effectiveMarriagePartnerId = selectedPartnerId || existingMarriagePartnerId || null;
        const hasActiveMarriage = Boolean(existingActiveMarriage?.MarriageID);
        const isSameActiveMarriagePair = hasActiveMarriage && effectiveMarriagePartnerId && existingMarriagePartnerId
            ? effectiveMarriagePartnerId === existingMarriagePartnerId
            : false;
        const normalizedExistingStartDate = existingActiveMarriage?.StartDate
            ? String(existingActiveMarriage.StartDate).slice(0, 10)
            : '';
        const normalizedSubmittedStartDate = formData.MarriageStartDate
            ? String(formData.MarriageStartDate).slice(0, 10)
            : '';
        const shouldUpdateExistingMarriageStartDate = Boolean(
            hasActiveMarriage
            && effectiveMarriagePartnerId
            && normalizedSubmittedStartDate
        );
        
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

        if (!formData.PersonDateOfBirth) {
            setError('Geboortedatum is verplicht.');
            return;
        }

        if (!formData.PersonPlaceOfBirth) {
            setError('Geboorteplaats is verplicht.');
            return;
        }

        if (formData.PartnerId && !formData.MarriageStartDate && !existingActiveMarriage?.MarriageID) {
            setError('Kies ook een startdatum huwelijk wanneer een partner is geselecteerd.');
            return;
        }

        if (formData.MarriageStartDate && !formData.PartnerId && !hasActiveMarriage) {
            setError('Kies eerst een partner om een huwelijk te starten.');
            return;
        }

        if (hasActiveMarriage && !normalizedSubmittedStartDate) {
            setError('Startdatum huwelijk is verplicht zolang er een actief huwelijk is.');
            return;
        }

        if (hasActiveMarriage && !effectiveMarriagePartnerId) {
            setError('Geen partner gevonden voor het actieve huwelijk.');
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
                PersonDateOfBirth: formData.PersonDateOfBirth,
                PersonPlaceOfBirth: formData.PersonPlaceOfBirth,
                PersonDateOfDeath: formData.PersonDateOfDeath || null,
                PersonPlaceOfDeath: formData.PersonPlaceOfDeath || null,
                PersonIsMale: personIsMaleValue,
                FatherId: formData.FatherId || null,
                MotherId: formData.MotherId || null,
                PartnerId: formData.PartnerId || null,
            };

            const hasPersonChanges = initialUpdateData
                ? Object.keys(updateData).some((key) => (updateData[key] ?? null) !== (initialUpdateData[key] ?? null))
                : true;

            // Persist active marriage updates independently from person updates.
            if (shouldUpdateExistingMarriageStartDate) {
                const updateMarriageResult = await updateMarriageStartDate(existingActiveMarriage.MarriageID, {
                    personAId: person.PersonID,
                    personBId: effectiveMarriagePartnerId,
                    startDate: normalizedSubmittedStartDate,
                });

                if (!updateMarriageResult.success) {
                    setError(`Startdatum huwelijk wijzigen mislukt: ${updateMarriageResult.error || 'onbekende fout'}`);
                    return;
                }
            }

            const updateResult = hasPersonChanges
                ? await updatePerson(person.PersonID, updateData)
                : { success: true, error: null };
            if (updateResult.success) {
                if (formData.PartnerId && formData.MarriageStartDate && !existingActiveMarriage?.MarriageID) {
                    const marriageResult = await createMarriage({
                        personAId: person.PersonID,
                        personBId: Number(formData.PartnerId),
                        startDate: formData.MarriageStartDate,
                    });

                    if (!marriageResult.success) {
                        setError(`Persoon opgeslagen, maar huwelijk starten mislukt: ${marriageResult.error || 'onbekende fout'}`);
                        return;
                    }
                }

                if (onSave) {
                    onSave({ ...person, ...updateData });
                }
            } else {
                if (shouldUpdateExistingMarriageStartDate) {
                    setError(`Trouwdatum opgeslagen, maar persoonsgegevens opslaan mislukt: ${updateResult.error || 'onbekende fout'}`);
                } else {
                    setError(updateResult.error || 'Opslaan mislukt. Probeer het opnieuw.');
                }
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

    const buildPersonUpdatePayload = (sourcePerson, fatherId, motherId, partnerId) => ({
        PersonGivvenName: sourcePerson?.PersonGivvenName || '',
        PersonFamilyName: sourcePerson?.PersonFamilyName || '',
        PersonDateOfBirth: sourcePerson?.PersonDateOfBirth || null,
        PersonPlaceOfBirth: sourcePerson?.PersonPlaceOfBirth || null,
        PersonDateOfDeath: sourcePerson?.PersonDateOfDeath || null,
        PersonPlaceOfDeath: sourcePerson?.PersonPlaceOfDeath || null,
        PersonIsMale: sourcePerson?.PersonIsMale === null || sourcePerson?.PersonIsMale === undefined
            ? null
            : Number(sourcePerson.PersonIsMale),
        FatherId: fatherId || null,
        MotherId: motherId || null,
        PartnerId: partnerId || null,
    });

    const handleOpenEndMarriageDialog = () => {
        setEndMarriageError('');
        setEndMarriagePartialWarning('');
        setEndMarriageDate(new Date().toISOString().split('T')[0]);
        setEndMarriageReason('scheiding');
        setEndMarriageDialogOpen(true);
    };

    const handleCloseEndMarriageDialog = () => {
        if (isEndingMarriage) {
            return;
        }
        setEndMarriageDialogOpen(false);
        setEndMarriageError('');
        setEndMarriagePartialWarning('');
        setPendingPartnerClear(null);
    };

    const refreshAfterMarriageEndSuccess = (currentUpdatePayload) => {
        setFormData(prev => ({
            ...prev,
            PartnerId: null,
            MarriageStartDate: '',
        }));
        setCurrentPartnerOption(null);
        setExistingActiveMarriage(null);
        setEndMarriageDialogOpen(false);
        setEndMarriagePartialWarning('');
        setPendingPartnerClear(null);

        if (onSave) {
            onSave({
                ...person,
                ...currentUpdatePayload,
            });
        }
    };

    const handleRetryPartnerClear = async () => {
        if (!pendingPartnerClear) {
            return;
        }

        setIsEndingMarriage(true);
        setEndMarriageError('');

        try {
            const partnerClearResult = await updatePerson(
                Number(pendingPartnerClear.partnerId),
                pendingPartnerClear.partnerUpdatePayload,
            );

            if (!partnerClearResult.success) {
                setEndMarriageError(`Partnerkoppeling bij de andere persoon kon nog niet worden leeggemaakt: ${partnerClearResult.error || 'onbekende fout'}`);
                return;
            }

            refreshAfterMarriageEndSuccess(pendingPartnerClear.currentUpdatePayload);
        } catch (err) {
            console.error('Error retrying partner clear:', err);
            setEndMarriageError('Herstelactie mislukt door een onverwachte fout.');
        } finally {
            setIsEndingMarriage(false);
        }
    };

    const handleConfirmEndMarriage = async () => {
        if (!existingActiveMarriage?.MarriageID) {
            setEndMarriageError('Geen actief huwelijk gevonden om te beëindigen.');
            return;
        }

        if (!endMarriageDate) {
            setEndMarriageError('Einddatum is verplicht.');
            return;
        }

        if (!endMarriageReason) {
            setEndMarriageError('Reden is verplicht.');
            return;
        }

        const partnerId = existingActiveMarriage.PartnerID || formData.PartnerId;
        if (!partnerId) {
            setEndMarriageError('Geen partner gevonden voor het actieve huwelijk.');
            return;
        }

        setIsEndingMarriage(true);
        setEndMarriageError('');

        try {
            const endResult = await endMarriage(existingActiveMarriage.MarriageID, {
                personAId: person.PersonID,
                personBId: Number(partnerId),
                endDate: endMarriageDate,
                endReason: endMarriageReason,
            });

            if (!endResult.success) {
                setEndMarriageError(endResult.error || 'Huwelijk beëindigen mislukt.');
                return;
            }

            const currentUpdatePayload = buildPersonUpdatePayload(
                {
                    ...person,
                    ...formData,
                    PersonIsMale: formData.PersonIsMale,
                },
                formData.FatherId,
                formData.MotherId,
                null,
            );

            const currentClearResult = await updatePerson(person.PersonID, currentUpdatePayload);
            if (!currentClearResult.success) {
                setEndMarriageError(`Huwelijk beëindigd, maar partner kon niet worden leeggemaakt voor huidige persoon: ${currentClearResult.error || 'onbekende fout'}`);
                return;
            }

            const [partnerDetails, partnerFatherId, partnerMotherId] = await Promise.all([
                getPersonDetails(partnerId, { throwOnError: true }),
                getFather(partnerId, { throwOnError: true }),
                getMother(partnerId, { throwOnError: true }),
            ]);

            if (partnerDetails) {
                const partnerUpdatePayload = buildPersonUpdatePayload(
                    partnerDetails,
                    partnerFatherId,
                    partnerMotherId,
                    null,
                );

                const partnerClearResult = await updatePerson(Number(partnerId), partnerUpdatePayload);
                if (!partnerClearResult.success) {
                    setPendingPartnerClear({
                        partnerId: Number(partnerId),
                        partnerUpdatePayload,
                        currentUpdatePayload,
                    });
                    setEndMarriagePartialWarning('Huwelijk is beëindigd en huidige persoon is bijgewerkt, maar de partnerkoppeling bij de andere persoon staat nog open.');
                    return;
                }
            }

            refreshAfterMarriageEndSuccess(currentUpdatePayload);
        } catch (err) {
            console.error('Error ending marriage:', err);
            setEndMarriageError('Er is een fout opgetreden bij het beëindigen van het huwelijk.');
        } finally {
            setIsEndingMarriage(false);
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

            <TextField
                label="Startdatum huwelijk"
                type="date"
                value={formData.MarriageStartDate}
                onChange={handleChange('MarriageStartDate')}
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: new Date().toISOString().split('T')[0] }}
                disabled={isSaving}
                helperText={
                    existingActiveMarriage?.MarriageID
                        ? 'Actief huwelijk gevonden. Startdatum mag je aanpassen zolang partner gelijk blijft en er geen overlap met andere huwelijken ontstaat.'
                        : 'Vul in om nieuw huwelijk te starten met geselecteerde partner.'
                }
            />

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

            {existingActiveMarriage?.MarriageID && (
                <Button
                    variant="outlined"
                    color="warning"
                    onClick={handleOpenEndMarriageDialog}
                    disabled={isSaving || isEndingMarriage}
                >
                    Huwelijk beëindigen
                </Button>
            )}

            <Dialog open={endMarriageDialogOpen} onClose={handleCloseEndMarriageDialog} fullWidth maxWidth="sm">
                <DialogTitle>Huwelijk beëindigen</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    {endMarriageError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {endMarriageError}
                        </Alert>
                    )}

                    {endMarriagePartialWarning && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {endMarriagePartialWarning}
                        </Alert>
                    )}

                    <TextField
                        label="Einddatum"
                        type="date"
                        fullWidth
                        value={endMarriageDate}
                        onChange={(event) => setEndMarriageDate(event.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ mt: 1 }}
                    />

                    <TextField
                        label="Reden"
                        select
                        fullWidth
                        value={endMarriageReason}
                        onChange={(event) => setEndMarriageReason(event.target.value)}
                        sx={{ mt: 2 }}
                    >
                        {MARRIAGE_END_REASONS.map((reason) => (
                            <MenuItem key={reason.value} value={reason.value}>
                                {reason.label}
                            </MenuItem>
                        ))}
                    </TextField>
                </DialogContent>
                <DialogActions>
                    {pendingPartnerClear && (
                        <Button onClick={handleRetryPartnerClear} color="warning" disabled={isEndingMarriage}>
                            Herstel partnerkoppeling afronden
                        </Button>
                    )}
                    <Button onClick={handleCloseEndMarriageDialog} disabled={isEndingMarriage}>
                        Annuleren
                    </Button>
                    <Button onClick={handleConfirmEndMarriage} color="warning" variant="contained" disabled={isEndingMarriage}>
                        {isEndingMarriage ? 'Beëindigen...' : 'Beëindigen'}
                    </Button>
                </DialogActions>
            </Dialog>
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
