import { Menu, MenuItem, Divider } from '@mui/material';
import PropTypes from 'prop-types';
import { getUserInfo } from '../services/authService';

/**
 * PersonContextMenu Component
 * Shows a context menu when a person triangle is clicked
 * View option shown to all users
 * Edit/Delete/Add menu items only shown to admin users
 */
const PersonContextMenu = ({
    anchorPosition,
    onClose,
    onEditPerson,
    onDeletePerson,
    onAddPerson,
    onViewPerson,
    onManageFiles,
    person,
}) => {
    const userInfo = getUserInfo();
    const isAdmin = userInfo?.is_admin === true;

    const handleViewClick = () => {
        if (onViewPerson && person) {
            onViewPerson(person);
        }
        onClose();
    };

    const handleEditClick = () => {
        if (onEditPerson && person) {
            onEditPerson(person);
        }
        onClose();
    };

    const handleDeleteClick = () => {
        if (onDeletePerson && person) {
            onDeletePerson(person);
        }
        onClose();
    };

    const handleAddClick = () => {
        if (onAddPerson && person) {
            onAddPerson(person);
        }
        onClose();
    };

    const handleFilesClick = () => {
        if (onManageFiles && person) {
            onManageFiles(person);
        }
        onClose();
    };

    return (
        <Menu
            open={Boolean(anchorPosition)}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={
                anchorPosition
                    ? { top: anchorPosition.y, left: anchorPosition.x }
                    : undefined
            }
        >
            <MenuItem onClick={handleViewClick}>
                Persoon inzien
            </MenuItem>
            {isAdmin && (
                <>
                    <MenuItem onClick={handleEditClick}>
                        Persoon bewerken
                    </MenuItem>
                    <MenuItem onClick={handleDeleteClick}>
                        Persoon verwijderen
                    </MenuItem>
                    <MenuItem onClick={handleAddClick}>
                        Persoon toevoegen
                    </MenuItem>
                </>
            )}
            {!isAdmin && (
                <MenuItem disabled style={{ cursor: 'not-allowed', pointerEvents: 'none' }}>
                    (Geen edit-rechten)
                </MenuItem>
            )}
            <Divider />
            <MenuItem onClick={handleFilesClick}>
                Bestanden
            </MenuItem>
        </Menu>
    );
};

PersonContextMenu.propTypes = {
    anchorPosition: PropTypes.shape({
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired,
    }),
    onClose: PropTypes.func.isRequired,
    onEditPerson: PropTypes.func.isRequired,
    onDeletePerson: PropTypes.func,
    onAddPerson: PropTypes.func,
    onViewPerson: PropTypes.func,
    onManageFiles: PropTypes.func,
    person: PropTypes.object,
};

export default PersonContextMenu;
