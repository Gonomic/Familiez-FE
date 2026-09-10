import { Link, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import CreateIcon from '@mui/icons-material/Create';
import PermDeviceInformationIcon from '@mui/icons-material/PermDeviceInformation';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import LogoutIcon from '@mui/icons-material/Logout';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';

import { initiateSSOLogout, getStoredToken, stopSessionKeepalive } from './services/authService';

const hasAuthState = () => {
    const token = Boolean(getStoredToken());
    const roleData = localStorage.getItem('familiez_user_role');
    return token || Boolean(roleData);
};

// Explicit label/path pairs: label and route no longer need to match 1:1
// (e.g. "Familiez info" now points to the new release dashboard, while the
// legacy release-notes page is kept reachable as "Familiez info (oud)").
const menuItems = [
    { label: 'Familiez bewerken', path: '/familiez-bewerken', icon: <CreateIcon key="create" /> },
    { label: 'Familiez info', path: '/release-dashboard', icon: <NewReleasesIcon key="info-new" /> },
    { label: 'Familiez info (oud)', path: '/familiez-info', icon: <PermDeviceInformationIcon key="info-old" /> },
    { label: 'Familiez systeem', path: '/familiez-systeem', icon: <SettingsSuggestIcon key="settings" /> },
    { label: 'Batch toevoegen huwelijk', path: '/batch-toevoegen-huwelijk', icon: <GroupAddIcon key="batch" /> },
];

function LeftDrawer({ open, onClose }) {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(hasAuthState());

    useEffect(() => {
        const updateAuth = () => setIsAuthenticated(hasAuthState());
        updateAuth();
        window.addEventListener('familiez-auth-updated', updateAuth);
        window.addEventListener('storage', updateAuth);
        return () => {
            window.removeEventListener('familiez-auth-updated', updateAuth);
            window.removeEventListener('storage', updateAuth);
        };
    }, []);

    const handleLogout = () => {
        onClose();
        // Stop session keepalive if enabled (NEW FEATURE)
        stopSessionKeepalive();
        // This will clear all local state AND redirect to Synology logout endpoint
        initiateSSOLogout();
    };

    const DrawerList = (
        <Box sx={{ width: 250, display: 'flex', flexDirection: 'column', height: '100%' }} role="presentation" onClick={onClose}>
            <List sx={{ flexGrow: 1 }}>
                {menuItems.map(({ label, path, icon }) => (
                    <ListItem key={label} disablePadding>
                        <ListItemButton component={Link} to={path}>
                            <ListItemIcon>
                                {icon}
                            </ListItemIcon>
                            <ListItemText primary={label} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
            {isAuthenticated && (
                <Box sx={{ mt: 'auto' }}>
                    <Divider />
                    <List>
                        <ListItem disablePadding>
                            <ListItemButton onClick={handleLogout}>
                                <ListItemIcon>
                                    <LogoutIcon />
                                </ListItemIcon>
                                <ListItemText primary="Logout" />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </Box>
            )}
        </Box>
    );

    return (
        <div>
            <Drawer open={open} onClose={onClose}>
                {DrawerList}
            </Drawer>
        </div>
    );
}

LeftDrawer.propTypes = {
    onClose: PropTypes.func.isRequired,
    open: PropTypes.bool.isRequired,
};

export default LeftDrawer;

