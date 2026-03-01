import { Box, TextField, Button, Typography } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * PersonViewForm Component
 * Read-only view of person details in the right drawer
 * Available to all users (not just admins)
 */
const PersonViewForm = ({ person, onClose }) => {
    if (!person) {
        return null;
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: 3,
                width: '100%',
            }}
        >
            <Typography variant="h6" gutterBottom>
                Persoon Inzien
            </Typography>

            <TextField
                label="Voornaam"
                value={person.PersonGivvenName || ''}
                fullWidth
                disabled
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Achternaam"
                value={person.PersonFamilyName || ''}
                fullWidth
                disabled
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Geboortedatum"
                type="date"
                value={person.PersonDateOfBirth || ''}
                fullWidth
                disabled
                InputLabelProps={{ shrink: true }}
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Geboorteplaats"
                value={person.PersonPlaceOfBirth || ''}
                fullWidth
                disabled
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Overlijdensdatum"
                type="date"
                value={person.PersonDateOfDeath || ''}
                fullWidth
                disabled
                InputLabelProps={{ shrink: true }}
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Plaats van overlijden"
                value={person.PersonPlaceOfDeath || ''}
                fullWidth
                disabled
                InputProps={{
                    readOnly: true,
                }}
            />

            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={onClose}
                >
                    Sluiten
                </Button>
            </Box>
        </Box>
    );
};

PersonViewForm.propTypes = {
    person: PropTypes.shape({
        PersonID: PropTypes.number.isRequired,
        PersonGivvenName: PropTypes.string,
        PersonFamilyName: PropTypes.string,
        PersonDateOfBirth: PropTypes.string,
        PersonDateOfDeath: PropTypes.string,
        PersonPlaceOfBirth: PropTypes.string,
        PersonPlaceOfDeath: PropTypes.string,
    }),
    onClose: PropTypes.func.isRequired,
};

export default PersonViewForm;
