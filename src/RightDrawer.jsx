import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { Autocomplete, TextField, Typography, Button, Divider } from "@mui/material";
import Drawer from '@mui/material/Drawer';
import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import debounce from 'lodash/debounce';
import PersonEditForm from './components/PersonEditForm';
import PersonDeleteForm from './components/PersonDeleteForm';
import PersonAddForm from './components/PersonAddForm';
import { getPersonsLike } from './services/familyDataService';

function RightDrawer({ open, onClose, onPersonSelected, personToEdit, onPersonUpdated, personToDelete, personToAdd, onPersonAdded, onPersonDeleted, onAddPersonClick }) {
    const navigate = useNavigate();
    const [person, setPerson] = useState(null);
    const [persons, setPersons] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const isSelectingRef = useRef(false);
    const [mode, setMode] = useState('select'); // 'select', 'edit', 'delete', 'add'

    const [nbrOfParentGenerations, setNbrOfParentGenerations] = useState('1');
    const [nbrOfChildGenerations, setNbrOfChildGenerations] = useState('1');

    // Update mode when personToEdit, personToDelete, or personToAdd changes
    useEffect(() => {
        if (personToDelete) {
            setMode('delete');
        } else if (personToAdd !== undefined) {
            setMode('add');
        } else if (personToEdit) {
            setMode('edit');
        } else {
            setMode('select');
        }
    }, [personToEdit, personToDelete, personToAdd]);

    // Handle atomic change of Autocomplete field
    const handleInputChange = (event, newInputValue) => {
        setInputValue(newInputValue);
        if (!isSelectingRef.current) {
            debouncedGetNames(newInputValue);
        }
        isSelectingRef.current = false;
    };

    // Debounced function to get names from server
    const debouncedGetNames = useRef(
        debounce(async (value) => {
            if (!isSelectingRef.current) {
                const data = await getPersonsLike(value);
                setPersons(data);
            }
        }, 1500)
    ).current;

    // Handle person selection from autocomplete
    const handlePersonChange = (event, newValue) => {
        setPerson(newValue);
        isSelectingRef.current = true;
    };

    // Handle person selected to build tree
    const handleBuildTree = () => {
        if (person && onPersonSelected) {
            const parentGens = Number.isFinite(Number(nbrOfParentGenerations))
                ? Number(nbrOfParentGenerations)
                : 0;
            const childGens = Number.isFinite(Number(nbrOfChildGenerations))
                ? Number(nbrOfChildGenerations)
                : 0;
            onPersonSelected(person, parentGens, childGens);
            navigate('/familiez-bewerken');
            onClose();
        }
    };

    // Handle adding a new person
    const handleAddPersonClick = () => {
        // Allow adding a person with or without a parent
        if (onAddPersonClick) {
            // Convert PersonIsMale from number to boolean if person exists
            const personToPass = person ? {
                ...person,
                PersonIsMale: Boolean(person.PersonIsMale)
            } : null;
            onAddPersonClick(personToPass);
        }
    };

    const handleNumericChange = (setter) => (event) => {
        const { value } = event.target;
        if (value === '') {
            setter('');
            return;
        }

        const parsed = parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            setter(String(parsed));
        }
    };

    // Handle saving edited person
    const handleSavePerson = (updatedPerson) => {
        if (onPersonUpdated) {
            onPersonUpdated(updatedPerson);
        }
        setMode('select');
    };

    // Handle canceling edit
    const handleCancelEdit = () => {
        setMode('select');
        if (onPersonUpdated) {
            onPersonUpdated(null); // Signal that edit was cancelled
        }
    };

    // Handle person deletion
    const handlePersonDeleted = () => {
        setMode('select');
        if (onPersonDeleted) {
            onPersonDeleted();
        }
        onClose();
    };

    // Handle canceling delete
    const handleCancelDelete = () => {
        setMode('select');
    };

    // Handle person added
    const handlePersonAdded = (newPerson) => {
        setMode('select');
        if (onPersonAdded) {
            onPersonAdded(newPerson);
        }
        onClose();
    };

    // Handle canceling add
    const handleCancelAdd = () => {
        setMode('select');
    };

    // Cleanup debounced function on unmount
    useEffect(() => {
        return () => {
            debouncedGetNames.cancel();
        };
    }, [debouncedGetNames]);

    return (
        <div>
            <Drawer anchor="right" open={open} onClose={onClose}>
                <Box sx={{ width: 400, padding: 2 }}>
                    {mode === 'select' ? (
                        <>
                            <Typography variant="h6" sx={{ mb: 3 }}>
                                Stamboom Opbouwen
                            </Typography>

                            <Autocomplete
                                value={person}
                                onChange={handlePersonChange}
                                inputValue={inputValue}
                                onInputChange={handleInputChange}
                                options={persons}
                                getOptionLabel={(option) => 
                                    `${option.PersonGivvenName} ${option.PersonFamilyName} (${option.PersonDateOfBirth})`
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Persoon"
                                        InputLabelProps={{ shrink: true }}
                                    />
                                )}
                                sx={{ mb: 2 }}
                            />
                            <Typography variant="caption" sx={{ display: 'block', mb: 3 }}>
                                Kies een persoon
                            </Typography>

                            <TextField
                                type="number"
                                label="Hoeveel generaties (over groot)ouders"
                                value={nbrOfParentGenerations}
                                onChange={handleNumericChange(setNbrOfParentGenerations)}
                                onFocus={(e) => e.target.select()}
                                InputProps={{ inputProps: { min: 0, step: 1 } }}
                                fullWidth
                                sx={{ mb: 2 }}
                            />

                            <TextField
                                type="number"
                                label="Hoeveel generaties (achter klein)kinderen"
                                value={nbrOfChildGenerations}
                                onChange={handleNumericChange(setNbrOfChildGenerations)}
                                onFocus={(e) => e.target.select()}
                                InputProps={{ inputProps: { min: 0, step: 1 } }}
                                fullWidth
                                sx={{ mb: 3 }}
                            />

                            <Button 
                                variant="contained" 
                                color="primary"
                                disabled={!person}
                                onClick={handleBuildTree}
                                fullWidth
                            >
                                Toon Stamboom
                            </Button>
                            <Button 
                                variant="outlined" 
                                color="primary"
                                onClick={handleAddPersonClick}
                                fullWidth
                                sx={{ mt: 2 }}
                            >
                                Persoon toevoegen
                            </Button>
                        </>
                    ) : mode === 'delete' ? (
                        <>
                            <PersonDeleteForm
                                person={personToDelete}
                                onDelete={handlePersonDeleted}
                                onCancel={handleCancelDelete}
                            />
                        </>
                    ) : mode === 'add' ? (
                        <>
                            <PersonAddForm
                                parentPerson={personToAdd}
                                onAdd={handlePersonAdded}
                                onCancel={handleCancelAdd}
                            />
                        </>
                    ) : (
                        <>
                            <PersonEditForm
                                person={personToEdit}
                                onSave={handleSavePerson}
                                onCancel={handleCancelEdit}
                            />
                        </>
                    )}
                </Box>
            </Drawer>
        </div>
    );
}

RightDrawer.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onPersonSelected: PropTypes.func.isRequired,
    personToEdit: PropTypes.object,
    onPersonUpdated: PropTypes.func,
    personToDelete: PropTypes.object,
    personToAdd: PropTypes.object,
    onPersonAdded: PropTypes.func,
    onPersonDeleted: PropTypes.func,
    onAddPersonClick: PropTypes.func,
};

export default RightDrawer;